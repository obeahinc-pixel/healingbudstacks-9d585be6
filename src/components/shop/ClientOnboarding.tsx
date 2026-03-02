import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildLegacyClientPayload, toAlpha3 } from '@/lib/drgreenApi';
import {
  User,
  MapPin,
  Stethoscope,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Clock,
  Camera,
  ShieldCheck,
  FileWarning,
  HeartPulse,
  Building2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/context/ShopContext';
import { useKycJourneyLog } from '@/hooks/useKycJourneyLog';

// Age calculation helper
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Valid postal code zones per country
const validPostalZones: Record<string, { pattern: RegExp; description: string }> = {
  PT: { 
    pattern: /^\d{4}(-\d{3})?$/, 
    description: 'Portuguese postal codes (e.g., 1000-001)' 
  },
  ZA: { 
    pattern: /^(0[1-9]\d{2}|1[0-8]\d{2}|19[0-5]\d|[2-9]\d{3})$/, 
    description: 'South African postal codes (0100-9999)' 
  },
  TH: { 
    pattern: /^10[0-9]{3}$/, 
    description: 'Bangkok area postal codes only (10XXX)' 
  },
  GB: { 
    pattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, 
    description: 'UK postal codes (England & Wales delivery zones)' 
  },
};

// Legal minimum ages by country
const legalAgeByCountry: Record<string, number> = {
  PT: 18, // Portugal - Medical cannabis legal at 18
  GB: 18, // UK - Medical cannabis legal at 18
  ZA: 18, // South Africa - Private use legal at 18
  TH: 20, // Thailand - Legal age for cannabis is 20
  US: 21, // USA - Federal standard
};

const DEFAULT_MINIMUM_AGE = 21; // Conservative fallback

// Get minimum age for a country
const getMinimumAge = (countryCode: string): number => {
  return legalAgeByCountry[countryCode] || DEFAULT_MINIMUM_AGE;
};

// Map country codes to full names for shipping display
const getCountryName = (code: string): string => {
  const countryNames: Record<string, string> = {
    PT: 'Portugal',
    GB: 'United Kingdom',
    ZA: 'South Africa',
    TH: 'Thailand',
  };
  return countryNames[code] || code;
};

// Create personal details schema with country-specific age validation
const createPersonalDetailsSchema = (countryCode: string) => {
  const minimumAge = getMinimumAge(countryCode);
  return z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters').max(50, 'First name is too long'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50, 'Last name is too long'),
    email: z.string().email('Invalid email address').max(255, 'Email is too long'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').max(20, 'Phone number is too long'),
    dateOfBirth: z.string().min(1, 'Date of birth is required').refine(
      (dob) => {
        const age = calculateAge(dob);
        return age >= minimumAge;
      },
      { message: `You must be at least ${minimumAge} years old to register for medical cannabis in your region` }
    ),
    gender: z.string().min(1, 'Please select your gender'),
  });
};

// Default schema for initial form (uses conservative age)
const personalDetailsSchema = createPersonalDetailsSchema('US');

const createAddressSchema = (country: string) => z.object({
  street: z.string().min(5, 'Street address is required').max(200, 'Street address is too long'),
  city: z.string().min(2, 'City is required').max(100, 'City name is too long'),
  postalCode: z.string().min(4, 'Postal code is required').refine(
    (code) => {
      const zone = validPostalZones[country];
      if (!zone) return true; // Allow if country not in our list
      return zone.pattern.test(code.trim());
    },
    { message: 'Delivery is not available in your postal zone' }
  ),
  country: z.string().min(2, 'Country is required'),
});

const addressSchema = z.object({
  street: z.string().min(5, 'Street address is required').max(200, 'Street address is too long'),
  city: z.string().min(2, 'City is required').max(100, 'City name is too long'),
  postalCode: z.string().min(4, 'Postal code is required'),
  country: z.string().min(2, 'Country is required'),
});

// Medical history schema matching exact Dr. Green API requirements
const medicalHistorySchema = z.object({
  // Safety gates - Yes/No required (stored as string for radio buttons)
  heartProblems: z.enum(['yes', 'no'], { required_error: 'This field is required' }),
  psychosisHistory: z.enum(['yes', 'no'], { required_error: 'This field is required' }),
  cannabisReaction: z.enum(['yes', 'no'], { required_error: 'This field is required' }),
  // Diagnosed conditions - checkbox array
  conditions: z.array(z.string()).default([]),
  // Current medications - checkbox array
  medications: z.array(z.string()).default([]),
  // Required boolean fields
  medicalHistory1: z.boolean().default(false), // Cancer treatment
  medicalHistory2: z.boolean().default(false), // Immunosuppressants
  medicalHistory3: z.boolean().default(false), // Liver disease
  medicalHistory6: z.boolean().default(false), // Suicidal history (optional per API)
  medicalHistory8: z.boolean().default(false), // Drug abuse history
  medicalHistory9: z.boolean().default(false), // Alcohol abuse history
  medicalHistory10: z.boolean().default(false), // Drug services care history
  medicalHistory11: z.string().default('0'), // Alcohol units per week
  medicalHistory12: z.boolean().default(false), // Using cannabis to reduce other meds
  medicalHistory13: z.string().default('never'), // How often cannabis used (API values)
  medicalHistory14: z.array(z.string()).default(['never']), // How cannabis used (API values)
  medicalHistory15: z.string().max(500).optional(), // Cannabis amount per day
  otherMedicalCondition: z.string().max(500).optional(), // Other condition text
  otherMedicalTreatments: z.string().max(500).optional(), // Other treatment text
  prescriptionsSupplements: z.string().max(1000).optional(), // Current prescriptions
});

const medicalSchema = z.object({
  conditions: z.string().min(10, 'Please describe your medical conditions').max(2000, 'Description is too long'),
  currentMedications: z.string().max(1000, 'Text is too long').optional(),
  allergies: z.string().max(500, 'Text is too long').optional(),
  previousCannabisUse: z.boolean(),
  doctorApproval: z.boolean().refine(
    (val) => val === true,
    { message: 'Healthcare provider consultation is required for medical cannabis registration' }
  ),
  consent: z.boolean().refine((val) => val, 'You must consent to continue'),
});

// Business registration schema
const businessSchema = z.object({
  isBusiness: z.boolean().default(false),
  businessType: z.string().optional(),
  businessName: z.string().optional(),
  businessAddress1: z.string().optional(),
  businessAddress2: z.string().optional(),
  businessCity: z.string().optional(),
  businessState: z.string().optional(),
  businessCountryCode: z.string().optional(),
  businessPostalCode: z.string().optional(),
});

type PersonalDetails = z.infer<typeof personalDetailsSchema>;
type Address = z.infer<typeof addressSchema>;
type Business = z.infer<typeof businessSchema>;
type MedicalHistory = z.infer<typeof medicalHistorySchema>;
type Medical = z.infer<typeof medicalSchema>;

const steps = [
  { id: 'personal', title: 'Personal Details', icon: User },
  { id: 'address', title: 'Shipping Address', icon: MapPin },
  { id: 'business', title: 'Business Details', icon: Building2 },
  { id: 'history', title: 'Medical History', icon: HeartPulse },
  { id: 'medical', title: 'Medical Information', icon: Stethoscope },
  { id: 'complete', title: 'Complete', icon: CheckCircle2 },
];

const businessTypes = [
  { value: 'dispensary', label: 'Dispensary' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'wellness_center', label: 'Wellness Center' },
  { value: 'research', label: 'Research Institution' },
  { value: 'other', label: 'Other' },
];

const countries = [
  { code: 'PT', name: 'Portugal' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'TH', name: 'Thailand' },
  { code: 'GB', name: 'United Kingdom' },
];

// Medical condition options - EXACT API VALUES per Dr. Green spec
const conditionOptions = [
  { value: 'adhd', label: 'ADHD' },
  { value: 'agoraphobia', label: 'Agoraphobia' },
  { value: 'anxiety', label: 'Anxiety' },
  { value: 'appetite_disorders', label: 'Appetite Disorders' },
  { value: 'arthritis', label: 'Arthritis' },
  { value: 'autistic_spectrum_disorder', label: 'Autistic Spectrum Disorder' },
  { value: 'back_and_neck_pain', label: 'Back & Neck Pain' },
  { value: 'bipolar', label: 'Bipolar' },
  { value: 'chronic_and_long_term_pain', label: 'Chronic/Long-term Pain' },
  { value: 'chronic_fatigue_syndrome', label: 'Chronic Fatigue Syndrome' },
  { value: 'cluster_headaches', label: 'Cluster Headaches' },
  { value: 'complex_regional_pain_syndrome', label: 'Complex Regional Pain Syndrome' },
  { value: 'depression', label: 'Depression' },
  { value: 'endometriosis', label: 'Endometriosis' },
  { value: 'epilepsy', label: 'Epilepsy' },
  { value: 'fibromyalgia', label: 'Fibromyalgia' },
  { value: 'irritable_bowel_syndrome', label: 'Irritable Bowel Syndrome' },
  { value: 'migraine', label: 'Migraine' },
  { value: 'multiple_sclerosis_pain_and_muscle_spasm', label: 'Multiple Sclerosis' },
  { value: 'nerve_pain', label: 'Nerve Pain' },
  { value: 'ocd', label: 'OCD' },
  { value: 'parkinsons_disease', label: "Parkinson's Disease" },
  { value: 'post_traumatic_stress_disorder', label: 'PTSD' },
  { value: 'sciatica', label: 'Sciatica' },
  { value: 'sleep_disorders', label: 'Sleep Disorders/Insomnia' },
  { value: 'tourette_syndrome', label: 'Tourette Syndrome' },
  { value: 'trigeminal_neuralgia', label: 'Trigeminal Neuralgia' },
  { value: 'other_medical_condition', label: 'Other' },
];

// Medication options - EXACT API VALUES per Dr. Green spec
const medicationOptions = [
  { value: 'amitriptyline', label: 'Amitriptyline' },
  { value: 'codeine', label: 'Codeine' },
  { value: 'diazepam', label: 'Diazepam' },
  { value: 'diclofenac', label: 'Diclofenac' },
  { value: 'fluoxetine', label: 'Fluoxetine' },
  { value: 'gabapentin', label: 'Gabapentin' },
  { value: 'lorazepam', label: 'Lorazepam' },
  { value: 'melatonin', label: 'Melatonin' },
  { value: 'mirtazapine', label: 'Mirtazapine' },
  { value: 'morphine', label: 'Morphine' },
  { value: 'naproxen', label: 'Naproxen' },
  { value: 'oxycodone', label: 'Oxycodone' },
  { value: 'sertraline', label: 'Sertraline' },
  { value: 'tramadol', label: 'Tramadol' },
  { value: 'venlafaxine', label: 'Venlafaxine' },
  { value: 'zolpidem', label: 'Zolpidem' },
  { value: 'zopiclone', label: 'Zopiclone' },
  { value: 'other_prescribed_medicines_treatments', label: 'Other' },
];

// Legacy medical history field labels for additional checkboxes
const medicalHistoryFields = [
  { key: 'medicalHistory1', label: 'Currently treated for cancer', description: 'Undergoing chemotherapy, radiation, or other cancer treatments' },
  { key: 'medicalHistory2', label: 'Taking immunosuppressants', description: 'Medications that suppress the immune system' },
  { key: 'medicalHistory3', label: 'History of liver disease', description: 'Including hepatitis, cirrhosis, or fatty liver' },
  { key: 'medicalHistory6', label: 'History of suicidal thoughts or self-harm', description: 'Past or current suicidal ideation' },
  { key: 'medicalHistory8', label: 'History of drug abuse or dependency', description: 'Including heroin, cocaine, prescription drug abuse' },
  { key: 'medicalHistory9', label: 'History of alcohol abuse', description: 'Past or current alcohol dependency' },
  { key: 'medicalHistory10', label: 'History of drug services care', description: 'Previous treatment for substance abuse' },
  { key: 'medicalHistory12', label: 'Using cannabis to reduce other medications', description: 'Seeking to reduce reliance on other prescribed medications' },
] as const;

// Cannabis frequency options - EXACT API VALUES
const cannabisUsageOptions = [
  { value: 'never', label: 'Never used' },
  { value: '1_2_times_per_week', label: 'Occasionally (1-2 times/week)' },
  { value: 'every_other_day', label: 'Regularly (every other day)' },
  { value: 'everyday', label: 'Daily' },
];

// Cannabis method options - EXACT API VALUES
const cannabisMethodOptions = [
  { value: 'never', label: 'Never used' },
  { value: 'smoking_joints', label: 'Smoking (Joints)' },
  { value: 'vaporizing', label: 'Vaporizing' },
  { value: 'ingestion', label: 'Edibles/Oils/Tinctures' },
  { value: 'topical', label: 'Topical' },
];

export function ClientOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [postalError, setPostalError] = useState<string | null>(null);
  const [kycLinkReceived, setKycLinkReceived] = useState<boolean | null>(null);
  const [storedClientId, setStoredClientId] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [kycProgress, setKycProgress] = useState(0);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    personal?: PersonalDetails;
    address?: Address;
    business?: Business;
    medicalHistory?: MedicalHistory;
    medical?: Medical;
  }>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshClient } = useShop();
  const { logEvent } = useKycJourneyLog();

  // Check for existing registration and pre-fill from auth session
  useEffect(() => {
    const initForm = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Pre-fill email and name from auth session
      const email = user.email || '';
      const fullName = user.user_metadata?.full_name || '';
      const [first, ...rest] = fullName.split(' ');
      personalForm.setValue('email', email);
      if (first) personalForm.setValue('firstName', first);
      if (rest.length) personalForm.setValue('lastName', rest.join(' '));

      const { data: existingClient } = await supabase
        .from('drgreen_clients')
        .select('id, drgreen_client_id, is_kyc_verified, admin_approval, kyc_link')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingClient) {
        navigate('/patient-dashboard');
        return;
      }
    };

    initForm();
    logEvent('registration.started', 'pending', { step: 0, stepName: 'personal' });
  }, [navigate, logEvent]);

  const personalForm = useForm<PersonalDetails>({
    resolver: zodResolver(personalDetailsSchema),
    defaultValues: formData.personal || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      gender: '',
    },
  });

  const addressForm = useForm<Address>({
    resolver: zodResolver(addressSchema),
    defaultValues: formData.address || {
      street: '',
      city: '',
      postalCode: '',
      country: 'PT',
    },
  });

  const businessForm = useForm<Business>({
    resolver: zodResolver(businessSchema),
    defaultValues: formData.business || {
      isBusiness: false,
      businessType: '',
      businessName: '',
      businessAddress1: '',
      businessAddress2: '',
      businessCity: '',
      businessState: '',
      businessCountryCode: '',
      businessPostalCode: '',
    },
  });

  const medicalHistoryForm = useForm<MedicalHistory>({
    resolver: zodResolver(medicalHistorySchema),
    defaultValues: formData.medicalHistory || {
      // Safety gates - required Yes/No
      heartProblems: undefined,
      psychosisHistory: undefined,
      cannabisReaction: undefined,
      // Condition and medication arrays
      conditions: [],
      medications: [],
      // Boolean fields
      medicalHistory1: false,
      medicalHistory2: false,
      medicalHistory3: false,
      medicalHistory6: false,
      medicalHistory8: false,
      medicalHistory9: false,
      medicalHistory10: false,
      medicalHistory11: '0',
      medicalHistory12: false,
      medicalHistory13: 'never', // API value
      medicalHistory14: ['never'], // API value
      medicalHistory15: '',
      otherMedicalCondition: '',
      otherMedicalTreatments: '',
      prescriptionsSupplements: '',
    },
  });

  const medicalForm = useForm<Medical>({
    resolver: zodResolver(medicalSchema),
    defaultValues: formData.medical || {
      conditions: '',
      currentMedications: '',
      allergies: '',
      previousCannabisUse: false,
      doctorApproval: false,
      consent: false,
    },
  });

  // Watch country for age and postal code validation
  const selectedCountry = addressForm.watch('country') || 'PT';
  const minimumAge = getMinimumAge(selectedCountry);

  const handlePersonalSubmit = (data: PersonalDetails) => {
    // Double-check age validation with country-specific minimum
    const minAge = getMinimumAge(selectedCountry);
    const age = calculateAge(data.dateOfBirth);
    if (age < minAge) {
      logEvent('registration.step_completed', 'pending', { step: 0, stepName: 'personal', blocked: true, reason: 'age' });
      // Redirect to Not Eligible page with context
      navigate('/not-eligible', { 
        state: { 
          reason: 'age', 
          country: countries.find(c => c.code === selectedCountry)?.name,
          minimumAge: minAge 
        } 
      });
      return;
    }
    setAgeError(null);
    setFormData((prev) => ({ ...prev, personal: data }));
    logEvent('registration.step_completed', 'pending', { step: 0, stepName: 'personal' });
    setCurrentStep(1);
  };

  const handleAddressSubmit = (data: Address) => {
    // Validate postal code against country zones
    const zone = validPostalZones[data.country];
    if (zone && !zone.pattern.test(data.postalCode.trim())) {
      logEvent('registration.step_completed', 'pending', { step: 1, stepName: 'address', blocked: true, reason: 'postal' });
      // Redirect to Not Eligible page with context
      navigate('/not-eligible', { 
        state: { 
          reason: 'postal',
          country: countries.find(c => c.code === data.country)?.name
        } 
      });
      return;
    }
    setPostalError(null);
    setFormData((prev) => ({ ...prev, address: data }));
    logEvent('registration.step_completed', 'pending', { step: 1, stepName: 'address', countryCode: data.country });
    setCurrentStep(2); // Go to Business Details step
  };

  const handleBusinessSubmit = (data: Business) => {
    setFormData((prev) => ({ ...prev, business: data }));
    logEvent('registration.step_completed', 'pending', { step: 2, stepName: 'business', isBusiness: data.isBusiness });
    setCurrentStep(3); // Go to Medical History step
  };

  const handleMedicalHistorySubmit = (data: MedicalHistory) => {
    setFormData((prev) => ({ ...prev, medicalHistory: data }));
    logEvent('registration.step_completed', 'pending', { step: 3, stepName: 'medical_history' });
    setCurrentStep(4); // Go to Medical Information step
  };

  const handleMedicalSubmit = async (data: Medical) => {
    setFormData((prev) => ({ ...prev, medical: data }));
    logEvent('registration.step_completed', 'pending', { step: 4, stepName: 'medical' });
    logEvent('registration.submitted', 'pending', { countryCode: formData.address?.country });
    setIsSubmitting(true);
    setDocumentError(null);
    setKycStatus('verifying');
    setKycProgress(0);

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      setKycProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        clearInterval(progressInterval);
        setKycStatus('idle');
        toast({
          title: 'Authentication required',
          description: 'Please sign in to continue.',
          variant: 'destructive',
        });
        return;
      }

      // First, check if user already has a Dr. Green client (prevent duplicates)
      console.log('[Registration] Checking for existing Dr. Green client...');
      try {
        const { data: existingCheck, error: checkError } = await supabase.functions.invoke('drgreen-proxy', {
          body: { action: 'get-client-by-auth-email' },
        });
        
        if (!checkError && existingCheck?.found && existingCheck?.clientId) {
          console.log('[Registration] Found existing Dr. Green client:', existingCheck.clientId);
          
          // User already has a Dr. Green client - link it instead of creating new
          const { error: upsertError } = await supabase.from('drgreen_clients').upsert({
            user_id: user.id,
            drgreen_client_id: existingCheck.clientId,
            country_code: formData.address?.country || 'PT',
            is_kyc_verified: existingCheck.isKYCVerified ?? false,
            admin_approval: existingCheck.adminApproval || 'PENDING',
            kyc_link: existingCheck.kycLink || null,
            email: formData.personal?.email || null,
            full_name: formData.personal ? `${formData.personal.firstName} ${formData.personal.lastName}`.trim() : null,
          }, {
            onConflict: 'user_id',
          });
          
          if (upsertError) {
            console.error('[Registration] Failed to link existing client:', upsertError);
          } else {
            clearInterval(progressInterval);
            setKycProgress(100);
            setStoredClientId(existingCheck.clientId);
            setKycLinkReceived(!!existingCheck.kycLink);
            setKycStatus('success');
            setCurrentStep(5);
            await refreshClient();
            
            toast({
              title: 'Account linked!',
              description: existingCheck.isKYCVerified 
                ? 'Your verified account has been linked.' 
                : 'Please complete KYC verification to continue.',
            });
            
            setIsSubmitting(false);
            return;
          }
        }
      } catch (checkErr) {
        console.log('[Registration] Existing client check failed, proceeding with creation:', checkErr);
        // Continue with creation if check fails
      }

      // Prepare client data - NO local-* fallback
      let clientId: string | null = null;
      let kycLink: string | null = null;
      let apiSuccess = false;

      // Build legacy-compatible payload
      const legacyPayload = buildLegacyClientPayload({
        personal: formData.personal as {
          firstName: string;
          lastName: string;
          email: string;
          phone: string;
          dateOfBirth: string;
          gender?: string;
        },
        address: formData.address as {
          street: string;
          city: string;
          postalCode: string;
          country: string;
          state?: string;
        },
        business: formData.business,
        medicalHistory: formData.medicalHistory || {},
      });

      // Debug logging for testing
      console.log('[Registration] Form data collected:', {
        personal: formData.personal,
        address: formData.address,
        business: formData.business,
        medicalHistory: formData.medicalHistory,
      });
      console.log('[Registration] Legacy payload built:', JSON.stringify(legacyPayload, null, 2));
      console.log('[Registration] Has clientBusiness:', !!legacyPayload.clientBusiness);

      // Try to call edge function to create client
      try {
          console.log('[Registration] ========== PRE-REQUEST DIAGNOSTICS ==========');
          console.log('[Registration] Timestamp:', new Date().toISOString());
          console.log('[Registration] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
          console.log('[Registration] User ID:', user.id);
          
          // Verify session is still valid
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          console.log('[Registration] Session check:', { 
            hasSession: !!session, 
            error: sessionError?.message,
            expiresAt: session?.expires_at,
            tokenLength: session?.access_token?.length 
          });
          
          if (!session) {
            console.error('[Registration] No valid session - user may need to re-authenticate');
            toast({
              title: 'Session expired',
              description: 'Please sign in again to complete registration.',
              variant: 'destructive',
            });
            setIsSubmitting(false);
            clearInterval(progressInterval);
            return;
          }
          
          // Quick health check to verify edge function is reachable
          console.log('[Registration] Running health check...');
          const healthCheck = await supabase.functions.invoke('drgreen-proxy', {
            body: { action: 'health-check' }
          });
          console.log('[Registration] Health check result:', healthCheck);
          
          if (healthCheck.error) {
            console.error('[Registration] Health check failed:', healthCheck.error);
          }
          
          console.log('[Registration] ========== CALLING DRGREEN-PROXY ==========');
          console.log('[Registration] Action: create-client-legacy');
          
          const { data: result, error } = await supabase.functions.invoke('drgreen-proxy', {
            body: {
              action: 'create-client-legacy',
              payload: legacyPayload,
            },
          });
          
          console.log('[Registration] ========== EDGE FUNCTION RESPONSE ==========');
          console.log('[Registration] Result:', JSON.stringify(result, null, 2));
          console.log('[Registration] Error:', error ? JSON.stringify(error, null, 2) : 'none');
          console.log('[Registration] Result type:', typeof result);
          console.log('[Registration] Has clientId:', !!result?.clientId);
          console.log('[Registration] Has kycLink:', !!result?.kycLink);

          // Handle 422 Unprocessable Entity (e.g., blurry ID)
          if (error) {
            const errorData = error as any;
            if (errorData?.context?.status === 422 || result?.errorCode === 'DOCUMENT_QUALITY') {
              clearInterval(progressInterval);
              setKycStatus('error');
              setDocumentError('document_quality');
              setIsSubmitting(false);
              return;
            }
          }

          if (!error && result?.clientId) {
            clientId = result.clientId;
            kycLink = result.kycLink || null;
            apiSuccess = true;
            logEvent('registration.success', clientId, { hasKycLink: !!kycLink, countryCode: formData.address?.country });
            if (kycLink) {
              logEvent('kyc.link_received', clientId, { linkPresent: true });
            }
          }
          
          // Check for API-level errors in the result (even without JS error)
          if (result?.error || result?.statusCode >= 400) {
            console.warn('[Registration] Dr Green API returned error:', {
              error: result?.error,
              statusCode: result?.statusCode,
              message: result?.message,
            });
            logEvent('registration.api_error', 'pending', { 
              error: result?.error || 'Unknown',
              statusCode: result?.statusCode,
            });
          }
      } catch (apiError: any) {
        console.error('[Registration] ========== API CALL FAILED ==========');
        console.error('[Registration] Error type:', typeof apiError);
        console.error('[Registration] Error name:', apiError?.name);
        console.error('[Registration] Error message:', apiError?.message);
        console.error('[Registration] Error status:', apiError?.status);
        console.error('[Registration] Error stack:', apiError?.stack);
        console.error('[Registration] Full error object:', JSON.stringify(apiError, Object.getOwnPropertyNames(apiError), 2));
        
        // Check for 422 error in catch block
        if (apiError?.status === 422 || apiError?.message?.includes('Unprocessable')) {
          clearInterval(progressInterval);
          setKycStatus('error');
          setDocumentError('document_quality');
          logEvent('registration.error', 'pending', { error: 'document_quality' });
          setIsSubmitting(false);
          return;
        }
        
        // Check for 401 - API permission issue
        if (apiError?.status === 401 || apiError?.message?.includes('401') || apiError?.message?.includes('Unauthorized')) {
          console.error('[Registration] API returned 401 - credential permission issue');
          logEvent('registration.api_auth_error', 'pending', { 
            error: 'api_permission_denied',
            message: 'Dr Green API credentials lack required permissions'
          });
        } else {
          // Edge function failed - NO local-* fallback, show hard error
          console.error('[Registration] Dr Green API unavailable - blocking registration');
          logEvent('registration.error', 'pending', { error: 'api_unavailable', errorMessage: apiError?.message });
        }
        
        // API failed - do NOT create local client record, show blocking error
        clearInterval(progressInterval);
        setKycStatus('error');
        setDocumentError('api_unavailable');
        toast({
          title: 'Registration failed',
          description: 'Could not connect to the verification service. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Only proceed if we got a valid clientId from the API
      if (!clientId) {
        clearInterval(progressInterval);
        setKycStatus('error');
        setDocumentError('api_unavailable');
        toast({
          title: 'Registration incomplete',
          description: 'Could not create your patient profile. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      clearInterval(progressInterval);
      setKycProgress(100);

      // Build shipping address for local storage (ensures checkout fallback works)
      const localShippingAddress = formData.address ? {
        address1: formData.address.street?.trim() || '',
        city: formData.address.city?.trim() || '',
        state: formData.address.city?.trim() || '', // Use city as state fallback (address form doesn't have state field)
        country: getCountryName(formData.address.country) || 'Portugal',
        countryCode: toAlpha3(formData.address.country || 'PT'),
        postalCode: formData.address.postalCode?.trim() || '',
      } : null;

      // Store client info locally - only with valid API-provided clientId
      const { error: dbError } = await supabase.from('drgreen_clients').upsert({
        user_id: user.id,
        drgreen_client_id: clientId,
        country_code: formData.address?.country || 'PT',
        is_kyc_verified: false,
        admin_approval: 'PENDING',
        kyc_link: kycLink,
        email: formData.personal?.email || null,
        full_name: formData.personal ? `${formData.personal.firstName} ${formData.personal.lastName}`.trim() : null,
        shipping_address: localShippingAddress,
      }, {
        onConflict: 'user_id',
      });

      if (dbError) {
        // Only show error if DB upsert fails
        throw dbError;
      }

      await refreshClient();
      setStoredClientId(clientId);
      setKycLinkReceived(!!kycLink);
      setKycStatus('success');
      setCurrentStep(5); // Go to Complete step

      // Send welcome email
      try {
        console.log('[Registration] Sending welcome email...');
        await supabase.functions.invoke('send-client-email', {
          body: {
            type: 'welcome',
            email: formData.personal?.email,
            name: `${formData.personal?.firstName} ${formData.personal?.lastName}`,
            region: formData.address?.country || 'global',
            kycLink: kycLink || undefined,
            clientId: clientId,
          },
        });
        console.log('[Registration] Welcome email sent successfully');
      } catch (emailError) {
        // Don't fail registration if email fails
        console.warn('[Registration] Failed to send welcome email:', emailError);
      }

      // Send dedicated KYC verification email if link is available
      if (kycLink) {
        try {
          console.log('[Registration] Sending KYC verification email...');
          await supabase.functions.invoke('send-client-email', {
            body: {
              type: 'kyc-link',
              email: formData.personal?.email,
              name: `${formData.personal?.firstName} ${formData.personal?.lastName}`,
              region: formData.address?.country || 'global',
              kycLink: kycLink,
              clientId: clientId,
            },
          });
          console.log('[Registration] KYC verification email sent successfully');
        } catch (emailError) {
          console.warn('[Registration] Failed to send KYC email:', emailError);
        }
      }

      // Show appropriate toast based on API success
      if (kycLink) {
        toast({
          title: 'Registration complete!',
          description: 'Check your email for next steps.',
        });
      } else if (apiSuccess) {
        toast({
          title: 'Registration saved!',
          description: "We'll email your verification link shortly.",
        });
      } else {
        toast({
          title: 'Registration saved',
          description: 'This is taking longer than expected. Your information is saved.',
        });
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      setKycStatus('idle');
      console.error('Registration error:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again. Contact support if the problem persists.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry submission after document quality error
  const retrySubmission = () => {
    setDocumentError(null);
    setKycStatus('idle');
    // Re-trigger submission with existing form data
    if (formData.medical) {
      handleMedicalSubmit(formData.medical);
    }
  };

  // Retry function to request verification link
  const retryKycLink = async () => {
    setIsRetrying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: result, error } = await supabase.functions.invoke('drgreen-proxy', {
        body: {
          action: 'request-kyc-link',
          data: {
            clientId: storedClientId,
            personal: formData.personal,
            address: formData.address,
          },
        },
      });

      if (!error && result?.kycLink) {
        // Update the stored KYC link
        await supabase.from('drgreen_clients')
          .update({ kyc_link: result.kycLink })
          .eq('user_id', user.id);

        setKycLinkReceived(true);
        toast({
          title: 'Verification link sent!',
          description: 'Please check your email.',
        });
      } else {
        toast({
          title: 'Still processing',
          description: 'Please contact support if the problem persists.',
        });
      }
    } catch (error) {
      console.error('Retry KYC error:', error);
      toast({
        title: 'Still processing',
        description: 'Please contact support if the problem persists.',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Progress indicator */}
      <div className="mb-8">
        <p className="text-sm text-muted-foreground text-center mb-3">
          Step {currentStep + 1} of {steps.length} — {steps[currentStep].title}
        </p>
        <div className="hidden sm:flex justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex flex-col items-center ${
                index <= currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${
                  index < currentStep
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStep
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className="text-xs">{step.title}</span>
            </div>
          ))}
        </div>
        <div className="relative mt-2">
          <div className="absolute h-1 bg-muted w-full rounded" />
          <motion.div
            className="absolute h-1 bg-primary rounded"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Personal Details */}
        {currentStep === 0 && (
          <motion.div
            key="personal"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Details
                </CardTitle>
                <p className="text-sm text-muted-foreground">Welcome to Healing Buds. Let's set up your medical profile — it only takes a few minutes.</p>
              </CardHeader>
              <CardContent>
                <Form {...personalForm}>
                  <form
                    onSubmit={personalForm.handleSubmit(handlePersonalSubmit)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={personalForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={personalForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={personalForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="john@example.com"
                              readOnly
                              className="bg-muted/50"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Pre-filled from your account</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+351 123 456 789" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={personalForm.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                max={new Date(new Date().setFullYear(new Date().getFullYear() - minimumAge)).toISOString().split('T')[0]}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={personalForm.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You must be at least {minimumAge} years old to register in {countries.find(c => c.code === selectedCountry)?.name || 'your region'}
                    </p>
                    {ageError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{ageError}</span>
                      </div>
                    )}
                    <Button type="submit" className="w-full">
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Address */}
        {currentStep === 1 && (
          <motion.div
            key="address"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...addressForm}>
                  <form
                    onSubmit={addressForm.handleSubmit(handleAddressSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={addressForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country.code} value={country.code}>
                                  {country.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addressForm.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main Street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addressForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Lisbon" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addressForm.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input placeholder="1000-001" {...field} />
                            </FormControl>
                            <FormMessage />
                            {validPostalZones[selectedCountry] && (
                              <p className="text-xs text-muted-foreground">
                                {validPostalZones[selectedCountry].description}
                              </p>
                            )}
                          </FormItem>
                        )}
                      />
                    </div>
                    {postalError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{postalError}</span>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        className="flex-1"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" className="flex-1">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Business Details (Optional) */}
        {currentStep === 2 && (
          <motion.div
            key="business"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business Details
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  If you're registering on behalf of a business, please provide the details below. Otherwise, you can skip this step.
                </p>
              </CardHeader>
              <CardContent>
                <Form {...businessForm}>
                  <form
                    onSubmit={businessForm.handleSubmit(handleBusinessSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={businessForm.control}
                      name="isBusiness"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-medium cursor-pointer">
                              I am registering as a business
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Select this if you're a dispensary, clinic, pharmacy, or other business
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    {businessForm.watch('isBusiness') && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pt-2"
                      >
                        <FormField
                          control={businessForm.control}
                          name="businessType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {businessTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={businessForm.control}
                          name="businessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Your Company Ltd" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={businessForm.control}
                          name="businessAddress1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Address</FormLabel>
                              <FormControl>
                                <Input placeholder="123 Business Street" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={businessForm.control}
                          name="businessAddress2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address Line 2 (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Suite, Floor, Building" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={businessForm.control}
                            name="businessCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input placeholder="Lisbon" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={businessForm.control}
                            name="businessState"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State/Province</FormLabel>
                                <FormControl>
                                  <Input placeholder="Optional" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={businessForm.control}
                            name="businessCountryCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Country</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || formData.address?.country}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {countries.map((country) => (
                                      <SelectItem key={country.code} value={country.code}>
                                        {country.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={businessForm.control}
                            name="businessPostalCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Postal Code</FormLabel>
                                <FormControl>
                                  <Input placeholder="1000-001" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </motion.div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        className="flex-1"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" className="flex-1">
                        {businessForm.watch('isBusiness') ? 'Continue' : 'Skip & Continue'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Medical History (Legacy DAPP fields) */}
        {currentStep === 3 && (
          <motion.div
            key="medical-history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HeartPulse className="h-5 w-5" />
                  Medical History
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Please answer the following health screening questions honestly. This information helps us ensure your safety.
                </p>
              </CardHeader>
              <CardContent>
                <Form {...medicalHistoryForm}>
                  <form
                    onSubmit={medicalHistoryForm.handleSubmit(handleMedicalHistorySubmit)}
                    className="space-y-8"
                  >
                    {/* SAFETY GATES - Yes/No Radio Buttons (Required) */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Safety Screening
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        These questions are critical for your safety. Please answer honestly.
                      </p>
                      
                      {/* Heart Problems */}
                      <FormField
                        control={medicalHistoryForm.control}
                        name="heartProblems"
                        render={({ field }) => (
                          <FormItem className="p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
                            <FormLabel className="font-medium text-base">
                              Do you have a history of heart problems? *
                            </FormLabel>
                            <FormDescription className="text-sm">
                              Including heart disease, arrhythmia, heart attacks, or cardiovascular conditions
                            </FormDescription>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex gap-4 mt-3"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="heart-yes" />
                                  <label htmlFor="heart-yes" className="font-medium cursor-pointer">Yes</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="heart-no" />
                                  <label htmlFor="heart-no" className="font-medium cursor-pointer">No</label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Psychosis History */}
                      <FormField
                        control={medicalHistoryForm.control}
                        name="psychosisHistory"
                        render={({ field }) => (
                          <FormItem className="p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
                            <FormLabel className="font-medium text-base">
                              Do you have a history of Psychosis? *
                            </FormLabel>
                            <FormDescription className="text-sm">
                              Including schizophrenia, psychotic episodes, or severe psychiatric conditions
                            </FormDescription>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex gap-4 mt-3"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="psychosis-yes" />
                                  <label htmlFor="psychosis-yes" className="font-medium cursor-pointer">Yes</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="psychosis-no" />
                                  <label htmlFor="psychosis-no" className="font-medium cursor-pointer">No</label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Cannabis Reaction */}
                      <FormField
                        control={medicalHistoryForm.control}
                        name="cannabisReaction"
                        render={({ field }) => (
                          <FormItem className="p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
                            <FormLabel className="font-medium text-base">
                              Have you ever had an adverse reaction to Cannabis? *
                            </FormLabel>
                            <FormDescription className="text-sm">
                              Including severe anxiety, paranoia, allergic reactions, or other negative responses
                            </FormDescription>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex gap-4 mt-3"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="yes" id="reaction-yes" />
                                  <label htmlFor="reaction-yes" className="font-medium cursor-pointer">Yes</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="no" id="reaction-no" />
                                  <label htmlFor="reaction-no" className="font-medium cursor-pointer">No</label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* CONDITIONS - Checkbox Grid */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-base">Diagnosed Conditions</h4>
                      <p className="text-sm text-muted-foreground">
                        Select any conditions you have been diagnosed with:
                      </p>
                      <FormField
                        control={medicalHistoryForm.control}
                        name="conditions"
                        render={({ field }) => (
                          <FormItem>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {conditionOptions.map((condition) => (
                                <label
                                  key={condition.value}
                                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                    field.value?.includes(condition.value)
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
                                  }`}
                                >
                                  <Checkbox
                                    checked={field.value?.includes(condition.value)}
                                    onCheckedChange={(checked) => {
                                      const currentValues = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValues, condition.value]);
                                      } else {
                                        field.onChange(currentValues.filter((v) => v !== condition.value));
                                      }
                                    }}
                                  />
                                  <span className="font-medium text-sm">{condition.label}</span>
                                </label>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* MEDICATIONS - Checkbox Grid */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-base">Current Medications</h4>
                      <p className="text-sm text-muted-foreground">
                        Select any medications you are currently taking:
                      </p>
                      <FormField
                        control={medicalHistoryForm.control}
                        name="medications"
                        render={({ field }) => (
                          <FormItem>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {medicationOptions.map((medication) => (
                                <label
                                  key={medication.value}
                                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                    field.value?.includes(medication.value)
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
                                  }`}
                                >
                                  <Checkbox
                                    checked={field.value?.includes(medication.value)}
                                    onCheckedChange={(checked) => {
                                      const currentValues = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValues, medication.value]);
                                      } else {
                                        field.onChange(currentValues.filter((v) => v !== medication.value));
                                      }
                                    }}
                                  />
                                  <span className="font-medium text-sm">{medication.label}</span>
                                </label>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Additional Health Conditions - Legacy Checkboxes */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-base">Additional Health Information</h4>
                      <div className="space-y-3">
                        {medicalHistoryFields.map((field) => (
                          <FormField
                            key={field.key}
                            control={medicalHistoryForm.control}
                            name={field.key as keyof MedicalHistory}
                            render={({ field: formField }) => (
                              <FormItem className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                                <FormControl>
                                  <Checkbox
                                    checked={formField.value as boolean}
                                    onCheckedChange={formField.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="font-normal cursor-pointer">
                                    {field.label}
                                  </FormLabel>
                                  <FormDescription className="text-xs">
                                    {field.description}
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Alcohol consumption */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-base">Alcohol Consumption</h4>
                      <FormField
                        control={medicalHistoryForm.control}
                        name="medicalHistory11"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alcohol units per week</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select amount" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="0">None</SelectItem>
                                <SelectItem value="1-7">1-7 units</SelectItem>
                                <SelectItem value="8-14">8-14 units</SelectItem>
                                <SelectItem value="15-21">15-21 units</SelectItem>
                                <SelectItem value="22+">22+ units</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              1 unit = 1 small glass of wine, half pint of beer, or 1 shot
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Cannabis usage section */}
                    <div className="space-y-6">
                      <h4 className="font-semibold text-base">Cannabis History</h4>
                      
                      {/* Cannabis frequency */}
                      <FormField
                        control={medicalHistoryForm.control}
                        name="medicalHistory13"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>How often do you currently use cannabis? *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {cannabisUsageOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Cannabis usage methods - multi-select */}
                      <FormField
                        control={medicalHistoryForm.control}
                        name="medicalHistory14"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>How have you used cannabis? *</FormLabel>
                            <FormDescription>Select all that apply</FormDescription>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                              {cannabisMethodOptions.map((method) => (
                                <label
                                  key={method.value}
                                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                    field.value?.includes(method.value)
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
                                  }`}
                                >
                                  <Checkbox
                                    checked={field.value?.includes(method.value)}
                                    onCheckedChange={(checked) => {
                                      const currentValues = field.value || [];
                                      if (checked) {
                                        // Remove 'never' if selecting other options
                                        const newValues = method.value === 'never' 
                                          ? ['never'] 
                                          : [...currentValues.filter(v => v !== 'never'), method.value];
                                        field.onChange(newValues);
                                      } else {
                                        const newValues = currentValues.filter((v) => v !== method.value);
                                        field.onChange(newValues.length ? newValues : ['never']);
                                      }
                                    }}
                                  />
                                  <span className="font-medium text-sm">{method.label}</span>
                                </label>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Cannabis amount per day - only show if user has used cannabis */}
                      {medicalHistoryForm.watch('medicalHistory13') !== 'never' && (
                        <FormField
                          control={medicalHistoryForm.control}
                          name="medicalHistory15"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>How much cannabis do you currently use per day?</FormLabel>
                              <FormDescription>
                                Please specify in grams, ounces, or number of joints
                              </FormDescription>
                              <FormControl>
                                <Input
                                  placeholder="e.g., 0.5g, 1 joint, 2g"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {/* Prescriptions and supplements */}
                    <FormField
                      control={medicalHistoryForm.control}
                      name="prescriptionsSupplements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Prescriptions & Supplements (Optional)</FormLabel>
                          <FormDescription>
                            List any current prescriptions and over the counter supplements, including CBD oils/products
                          </FormDescription>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., Vitamin D 1000IU daily, CBD oil 10mg..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Other medical condition details */}
                    {medicalHistoryForm.watch('conditions')?.includes('other_medical_condition') && (
                      <FormField
                        control={medicalHistoryForm.control}
                        name="otherMedicalCondition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Please specify your other medical condition</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Describe your condition..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Other medications details */}
                    {medicalHistoryForm.watch('medications')?.includes('other_prescribed_medicines_treatments') && (
                      <FormField
                        control={medicalHistoryForm.control}
                        name="otherMedicalTreatments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Please specify your other medications/treatments</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="List your other medications..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        className="flex-1"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" className="flex-1">
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 5: Medical Information */}
        {currentStep === 4 && (
          <motion.div
            key="medical"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Medical Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...medicalForm}>
                  <form
                    onSubmit={medicalForm.handleSubmit(handleMedicalSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={medicalForm.control}
                      name="conditions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medical Conditions</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your medical conditions that you're seeking treatment for..."
                              className="min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="currentMedications"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Medications (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="List any medications you're currently taking..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="allergies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Allergies (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="List any known allergies..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="previousCannabisUse"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            I have previous experience with medical cannabis
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="doctorApproval"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="font-medium">
                              I have discussed medical cannabis with my healthcare provider *
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Medical consultation is required before accessing cannabis products
                            </p>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="consent"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0 p-4 bg-muted/30 rounded-lg">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="font-normal">
                              I consent to the processing of my medical information
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Your information will be handled in accordance with GDPR
                              and medical data protection regulations.
                            </p>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        className="flex-1"
                        disabled={isSubmitting}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            Submit
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* KYC Verification In Progress Screen */}
        {currentStep === 4 && kycStatus === 'verifying' && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <Card className="max-w-md w-full mx-4 bg-card/95 border-border/50">
              <CardContent className="pt-8 pb-8 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
                >
                  <ShieldCheck className="h-10 w-10 text-primary" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">We're Verifying Your ID</h2>
                <p className="text-muted-foreground mb-6">
                  Please wait while we process your information. This usually takes a few moments.
                </p>
                <div className="space-y-2">
                  <Progress value={kycProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {kycProgress < 30 && 'Validating your information...'}
                    {kycProgress >= 30 && kycProgress < 60 && 'Checking eligibility...'}
                    {kycProgress >= 60 && kycProgress < 90 && 'Preparing verification link...'}
                    {kycProgress >= 90 && 'Almost done...'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Document Quality Error Screen (422) */}
        {currentStep === 4 && documentError === 'document_quality' && (
          <motion.div
            key="document-error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-destructive/30">
              <CardContent className="pt-8 pb-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6"
                >
                  <FileWarning className="h-10 w-10 text-destructive" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2 text-destructive">Document Issue Detected</h2>
                <p className="text-muted-foreground mb-6">
                  We couldn't process your submission. This is usually due to image quality issues.
                </p>
                
                <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Tips for a successful submission:
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Ensure your ID photo is clear and not blurry
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Use good lighting — avoid glare or shadows
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Make sure all corners of the document are visible
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Use a plain background without patterns
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={retrySubmission}
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Still having issues? Please <button onClick={() => navigate('/support')} className="text-primary underline">contact support</button> for assistance.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* API Unavailable Error Screen */}
        {currentStep === 4 && documentError === 'api_unavailable' && (
          <motion.div
            key="api-error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-destructive/30">
              <CardContent className="pt-8 pb-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6"
                >
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Connection Issue</h2>
                <p className="text-muted-foreground mb-6">
                  We couldn't connect to the verification service. This is usually temporary.
                </p>
                
                <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left">
                  <h3 className="font-medium mb-3">What you can do:</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">1.</span>
                      Wait a moment and try again
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">2.</span>
                      Check your internet connection
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">3.</span>
                      If the problem persists, contact our support team
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={retrySubmission}
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Try Again
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Need help? <button onClick={() => navigate('/support')} className="text-primary underline">Contact support</button>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 6: Complete */}
        {currentStep === 5 && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 text-center">
              <CardContent className="pt-8 pb-8 space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
                  <p className="text-muted-foreground text-sm">
                    Your medical profile has been submitted successfully.
                  </p>
                </div>
                
                {/* What happens next - always show */}
                <div className="rounded-xl bg-muted/50 border border-border/50 p-5 text-left space-y-3">
                  <h3 className="font-semibold text-foreground text-sm">What happens next?</h3>
                  <ol className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                      <span><strong className="text-foreground">Check your email</strong> — we've sent a verification link to complete identity checks (KYC).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                      <span><strong className="text-foreground">Complete KYC</strong> — follow the link to verify your identity. This takes about 2 minutes.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                      <span><strong className="text-foreground">Medical review</strong> — our team reviews your application (1–2 business days).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                      <span><strong className="text-foreground">Start shopping</strong> — once approved, you'll have full access to the dispensary.</span>
                    </li>
                  </ol>
                </div>

                {kycLinkReceived ? (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                    <p className="text-sm text-foreground font-medium">
                      Verification email sent — check your inbox now
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                          Preparing your verification link...
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-6">
                        Check your email within the next few minutes. If you don't receive it:
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={retryKycLink}
                      disabled={isRetrying}
                      size="sm"
                      className="w-full"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Requesting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Resend Verification Email
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => navigate('/shop')}
                  >
                    Browse Products
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => navigate('/dashboard/status')}
                  >
                    View Account Status
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
