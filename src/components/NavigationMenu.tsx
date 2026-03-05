/**
 * NavigationMenu Component - Pharmaceutical Grade
 * 
 * Clean, premium desktop navigation with subtle gold hover accents.
 */

import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, ClipboardCheck, Leaf, HeadphonesIcon, Newspaper } from "lucide-react";

interface NavigationMenuProps {
  scrolled: boolean;
  onCloseAllDropdowns?: () => void;
  isDark?: boolean;
}

const NavigationMenu = ({ scrolled, isDark = true }: NavigationMenuProps) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const isShopActive = location.pathname === '/shop' || location.pathname.startsWith('/shop/');

  const navItems = [
    { path: '/research', label: 'Research', icon: FileText },
    { path: '/the-wire', label: 'The Wire', icon: Newspaper },
    { path: '/eligibility', label: 'Eligibility', icon: ClipboardCheck },
    { path: '/shop', label: 'Strains', icon: Leaf, isShop: true },
    { path: '/support', label: 'Support', icon: HeadphonesIcon },
  ];

  return (
    <nav className="hidden xl:flex items-center justify-center gap-1.5 overflow-hidden">
      {navItems.map((item) => {
        const active = item.isShop ? isShopActive : isActive(item.path);
        const Icon = item.icon;
        
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "relative px-3.5 py-2 rounded-lg font-medium transition-all duration-300",
              "text-sm flex items-center gap-1.5 whitespace-nowrap flex-shrink-0",
              "group",
              active
                ? "text-white bg-white/10"
                : "text-white/90 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className={cn(
              "w-4 h-4 transition-colors duration-300",
              active ? "text-white" : "text-white/60 group-hover:text-[#EAB308]"
            )} />
            {item.label}
            
            {/* Active underline — clean white */}
            {active && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 rounded-full bg-white" />
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export default NavigationMenu;