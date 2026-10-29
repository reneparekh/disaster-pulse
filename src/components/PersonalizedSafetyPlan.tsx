import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalamityEvent, CalamityType } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { calculateDistanceKm, requestBrowserLocation } from '../utils/geolocationUtils';
import { copyToClipboard } from '../utils/clipboardUtils';
import {
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Compass,
  AlertTriangle,
  CheckSquare,
  Square,
  Copy,
  Download,
  Printer,
  RefreshCw,
  FileText,
  Users,
  Home,
  Heart,
  Check,
  ChevronRight,
  Info,
  Flame,
  Waves,
  Wind,
  CloudRain,
  Snowflake,
  Activity,
  AlertOctagon,
  Share2,
  Trash2,
  Sliders,
  ExternalLink
} from 'lucide-react';

interface Props {
  events?: CalamityEvent[];
}

export interface HouseholdProfile {
  size: number;
  hasInfants: boolean;
  hasElderly: boolean;
  hasMobilityImpaired: boolean;
  hasPets: boolean;
  hasMedicalNeeds: boolean;
  medicalNotes: string;
  dwellingType: 'apartment' | 'house' | 'mobile_home' | 'coastal' | 'rural';
}

export interface LocationPreset {
  name: string;
  region: string;
  lat: number;
  lng: number;
  commonDisasters: CalamityType[];
  context: string;
}

const LOCATION_PRESETS: LocationPreset[] = [
  {
    name: 'San Francisco, CA',
    region: 'United States (Pacific Coast)',
    lat: 37.7749,
    lng: -122.4194,
    commonDisasters: ['earthquake', 'wildfire', 'tsunami', 'drought'],
    context: 'San Andreas Fault Zone & California Coastal Fire Belt',
  },
  {
    name: 'Tokyo',
    region: 'Japan (Kanto Region)',
    lat: 35.6762,
    lng: 139.6503,
    commonDisasters: ['earthquake', 'tsunami', 'cyclone', 'volcano'],
    context: 'Pacific Ring of Fire & Western Pacific Typhoon Corridor',
  },
  {
    name: 'Miami, FL',
    region: 'United States (Atlantic/Gulf)',
    lat: 25.7617,
    lng: -80.1918,
    commonDisasters: ['cyclone', 'flood', 'extreme_temp'],
    context: 'Atlantic Hurricane Corridor & Lowland Storm Surge Zone',
  },
  {
    name: 'Oklahoma City, OK',
    region: 'United States (Great Plains)',
    lat: 35.4676,
    lng: -97.5164,
    commonDisasters: ['tornado', 'blizzard', 'flood', 'extreme_temp'],
    context: 'North American Tornado Alley & Severe Convective Zone',
  },
  {
    name: 'Valencia',
    region: 'Spain (Mediterranean)',
    lat: 39.4699,
    lng: -0.3763,
    commonDisasters: ['flood', 'wildfire', 'extreme_temp', 'drought'],
    context: 'Mediterranean Basin Flash Flood & Iberian Wildfire Corridor',
  },
  {
    name: 'Padang, West Sumatra',
    region: 'Indonesia (Indian Ocean)',
    lat: -0.9492,
    lng: 100.3543,
    commonDisasters: ['volcano', 'earthquake', 'tsunami', 'landslide'],
    context: 'Sunda Megathrust Subduction & Mount Marapi Volcanic Arc',
  },
  {
    name: 'Denver, CO',
    region: 'United States (Rocky Mountains)',
    lat: 39.7392,
    lng: -104.9903,
    commonDisasters: ['blizzard', 'avalanche', 'wildfire', 'tornado'],
    context: 'Rocky Mountain Front Range & High Elevation Severe Weather',
  },
  {
    name: 'Manila',
    region: 'Philippines (Luzon)',
    lat: 14.5995,
    lng: 120.9842,
    commonDisasters: ['cyclone', 'earthquake', 'flood', 'volcano'],
    context: 'Western Pacific Typhoon Belt & Philippine Mobile Belt',
  },
  {
    name: 'Reykjavik',
    region: 'Iceland (North Atlantic)',
    lat: 64.1466,
    lng: -21.9426,
    commonDisasters: ['volcano', 'earthquake', 'blizzard'],
    context: 'Mid-Atlantic Ridge Rifting & Sub-Arctic Volcanic Fields',
  },
];

export interface SafetyPlanItem {
  id: string;
  category: 'GO_BAG' | 'HOME_HARDENING' | 'COMMUNICATION' | 'HAZARD_SPECIFIC' | 'DOCUMENTS';
  categoryTitle: string;
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'RECOMMENDED';
  relevantHazards?: CalamityType[];
  specialHouseholdTag?: string;
}

const STORAGE_KEY_CHECKED = 'safety_plan_checked_items_v1';
const STORAGE_KEY_PROFILE = 'safety_plan_household_profile_v1';

export const PersonalizedSafetyPlan: React.FC<Props> = ({ events = [] }) => {
  // Location state
  const [cityName, setCityName] = useState<string>('San Francisco, CA');
  const [regionName, setRegionName] = useState<string>('United States (Pacific Coast)');
  const [latitude, setLatitude] = useState<number>(37.7749);
  const [longitude, setLongitude] = useState<number>(122.4194);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [locationStatusMsg, setLocationStatusMsg] = useState<string | null>(null);

  // Household Profile state
  const [profile, setProfile] = useState<HouseholdProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      size: 2,
      hasInfants: false,
      hasElderly: false,
      hasMobilityImpaired: false,
      hasPets: true,
      hasMedicalNeeds: false,
      medicalNotes: '',
      dwellingType: 'apartment',
    };
  });

  // Selected hazard types to include in safety plan
  const [selectedHazards, setSelectedHazards] = useState<CalamityType[]>([
    'earthquake',
    'wildfire',
    'tsunami',
    'flood',
  ]);

  // Checked state for checklist items
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHECKED);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  // View mode: 'interactive' (checklist cards) vs 'text' (monospaced text plan)
  const [viewMode, setViewMode] = useState<'interactive' | 'text'>('interactive');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');

  // Save profile to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  // Save checked items to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHECKED, JSON.stringify(checkedItems));
    } catch {
      // ignore
    }
  }, [checkedItems]);

  // Handle GPS detection
  const handleDetectGPS = async () => {
    setIsDetectingLocation(true);
    setLocationStatusMsg(null);
    try {
      const loc = await requestBrowserLocation();
      setLatitude(Number(loc.lat.toFixed(4)));
      setLongitude(Number(loc.lng.toFixed(4)));
      
      // Try reverse geocoding via Open-Meteo or fallback
      let detectedName = 'Local GPS Sector';
      let detectedRegion = `${loc.lat.toFixed(2)}°, ${loc.lng.toFixed(2)}°`;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json`,
          { headers: { 'User-Agent': 'DisasterSafetyPlan/1.0' } }
        );
        if (res.ok) {
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.county || 'Current Coordinates';
          const country = data.address?.country || 'Detected Region';
          detectedName = city;
          detectedRegion = country;
        }
      } catch {
        // Fallback to coordinate approximation
        detectedName = `Coordinates (${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)})`;
      }

      setCityName(detectedName);
      setRegionName(detectedRegion);

      // Auto-analyze regional hazards based on coordinates
      const deducedHazards = deduceRegionalHazards(loc.lat, loc.lng);
      setSelectedHazards(deducedHazards);

      setLocationStatusMsg(`GPS Locked: ${detectedName} (${loc.lat.toFixed(3)}°, ${loc.lng.toFixed(3)}°)`);
      setTimeout(() => setLocationStatusMsg(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve location.';
      setLocationStatusMsg(`GPS Error: ${message}`);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Helper to deduce regional hazards from coordinates
  const deduceRegionalHazards = (lat: number, lng: number): CalamityType[] => {
    const hazards: Set<CalamityType> = new Set();

    // Pacific Ring of Fire (Seismic / Tsunami / Volcano)
    const isRingOfFire = 
      (lat >= -60 && lat <= 65 && lng >= 110 && lng <= 180) ||
      (lat >= -60 && lat <= 65 && lng >= -180 && lng <= -65);
    if (isRingOfFire) {
      hazards.add('earthquake');
      hazards.add('tsunami');
    }

    // Mediterranean / Middle East (Earthquake, Wildfire, Heat, Flood)
    if (lat >= 30 && lat <= 46 && lng >= -10 && lng <= 50) {
      hazards.add('earthquake');
      hazards.add('wildfire');
      hazards.add('flood');
      hazards.add('extreme_temp');
    }

    // North American West Coast
    if (lat >= 30 && lat <= 55 && lng >= -126 && lng <= -115) {
      hazards.add('earthquake');
      hazards.add('wildfire');
      hazards.add('drought');
    }

    // Gulf of Mexico & Atlantic Hurricane Corridor
    if (lat >= 10 && lat <= 35 && lng >= -100 && lng <= -60) {
      hazards.add('cyclone');
      hazards.add('flood');
    }

    // Tornado Alley / US Midwest
    if (lat >= 30 && lat <= 48 && lng >= -104 && lng <= -86) {
      hazards.add('tornado');
      hazards.add('blizzard');
      hazards.add('flood');
    }

    // Mountainous & Alpine belts
    if ((lat >= 36 && lat <= 48 && lng >= 5 && lng <= 18) || (lat >= 35 && lat <= 52 && lng >= -115 && lng <= -100)) {
      hazards.add('avalanche');
      hazards.add('blizzard');
      hazards.add('landslide');
    }

    // Monsoon / Typhoon Asia
    if (lat >= 5 && lat <= 35 && lng >= 70 && lng <= 135) {
      hazards.add('cyclone');
      hazards.add('flood');
      hazards.add('landslide');
    }

    // Always include at least earthquake, flood, extreme_temp if empty
    if (hazards.size === 0) {
      hazards.add('flood');
      hazards.add('extreme_temp');
      hazards.add('earthquake');
    }

    return Array.from(hazards);
  };

  // Preset selector
  const handleSelectPreset = (preset: LocationPreset) => {
    setCityName(preset.name);
    setRegionName(preset.region);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
    setSelectedHazards(preset.commonDisasters);
    setLocationStatusMsg(`Loaded preset: ${preset.name} • ${preset.context}`);
    setTimeout(() => setLocationStatusMsg(null), 4000);
  };

  // Cross-reference live active disasters from events array within 800 km
  const nearbyActiveHazards = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    return events
      .map(ev => {
        const dist = calculateDistanceKm(
          latitude,
          longitude,
          ev.coordinates.lat,
          ev.coordinates.lng
        );
        return {
          event: ev,
          distanceKm: dist,
        };
      })
      .filter(item => item.distanceKm <= 850)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [events, latitude, longitude]);

  // Toggle hazard selection
  const toggleHazard = (type: CalamityType) => {
    setSelectedHazards(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Generate customized actionable checklist items
  const generatedPlanItems: SafetyPlanItem[] = useMemo(() => {
    const items: SafetyPlanItem[] = [];

    // --- SECTION 1: GO-BAG / 15-MINUTE EVACUATION KIT ---
    items.push({
      id: 'gobag-water',
      category: 'GO_BAG',
      categoryTitle: '15-Minute Evacuation Go-Bag',
      title: 'Potable Drinking Water (3-Day Supply)',
      description: `Maintain at least 1 gallon per day per person (${profile.size * 3} gallons total)${profile.hasPets ? ' plus 1 additional gallon for pets' : ''} in portable, puncture-proof jugs with purification tablets.`,
      priority: 'CRITICAL',
    });

    items.push({
      id: 'gobag-food',
      category: 'GO_BAG',
      categoryTitle: '15-Minute Evacuation Go-Bag',
      title: 'Calorie-Dense Non-Perishable Rations',
      description: `High-protein energy bars, dehydrated meals, and MRE rations for ${profile.size} individuals requiring no cooking water or stove. Include a manual steel can opener.`,
      priority: 'CRITICAL',
    });

    items.push({
      id: 'gobag-firstaid',
      category: 'GO_BAG',
      categoryTitle: '15-Minute Evacuation Go-Bag',
      title: 'Tactical First Aid & Trauma Kit',
      description: 'Tourniquet, sterile gauze rolls, burn dressings, antiseptic wipes, suture strips, surgical scissors, and nitrile gloves.',
      priority: 'CRITICAL',
    });

    items.push({
      id: 'gobag-radio-power',
      category: 'GO_BAG',
      categoryTitle: '15-Minute Evacuation Go-Bag',
      title: 'Hand-Crank NOAA Weather Radio & 20,000mAh Power Bank',
      description: 'Emergency receiver for civil defense sirens and alerts during cell tower blackout, plus high-capacity battery bank with heavy-duty USB charging cables.',
      priority: 'CRITICAL',
    });

    items.push({
      id: 'gobag-lighting',
      category: 'GO_BAG',
      categoryTitle: '15-Minute Evacuation Go-Bag',
      title: 'High-Lumen Tactical Flashlight & Headlamps',
      description: 'Waterproof LED headlamps per household member with 2 spare sets of lithium batteries or sealed rechargeable storage.',
      priority: 'HIGH',
    });

    items.push({
      id: 'gobag-masks-thermal',
      category: 'GO_BAG',
      categoryTitle: '15-Minute Evacuation Go-Bag',
      title: 'N95 Respirators & Mylar Thermal Blankets',
      description: 'Particulate masks against wildfire ash, pulverized earthquake masonry, or airborne contaminants, plus aluminized hypothermia body wraps.',
      priority: 'HIGH',
    });

    items.push({
      id: 'gobag-multitool-whistle',
      category: 'GO_BAG',
      categoryTitle: '15-Minute Evacuation Go-Bag',
      title: 'Heavy Duty Multi-Tool & High-Decibel Signal Whistle',
      description: 'Pliers, wire-cutters, emergency blade, and a 120dB pea-less whistle for signaling search & rescue teams if trapped under debris.',
      priority: 'HIGH',
    });

    // Special household go-bag additions
    if (profile.hasInfants) {
      items.push({
        id: 'gobag-infant',
        category: 'GO_BAG',
        categoryTitle: '15-Minute Evacuation Go-Bag',
        title: 'Infant Survival Pack',
        description: '3 days of pre-mixed infant formula, sanitized bottles, 30 diapers, baby wipes, electrolyte oral solution, and warm baby carrier sling.',
        priority: 'CRITICAL',
        specialHouseholdTag: 'Infant Protocol',
      });
    }

    if (profile.hasPets) {
      items.push({
        id: 'gobag-pets',
        category: 'GO_BAG',
        categoryTitle: '15-Minute Evacuation Go-Bag',
        title: 'Pet Emergency Evacuation Carrier & Supplies',
        description: 'Hard-shell animal carrier/crate, collapsible silicone bowls, 5 days dry pet food, rabies vaccine proof, slip leashes, and ID collar with phone number.',
        priority: 'HIGH',
        specialHouseholdTag: 'Pet Preparedness',
      });
    }

    if (profile.hasMedicalNeeds) {
      items.push({
        id: 'gobag-meds',
        category: 'GO_BAG',
        categoryTitle: '15-Minute Evacuation Go-Bag',
        title: '14-Day Prescription Medications & Medical Directives',
        description: `Dedicated waterproof medical pack containing: ${profile.medicalNotes || 'Critical prescription medicines'}, doctor contact cards, insulin cooling sleeve, or emergency medical gear.`,
        priority: 'CRITICAL',
        specialHouseholdTag: 'Medical Priority',
      });
    }

    if (profile.hasElderly || profile.hasMobilityImpaired) {
      items.push({
        id: 'gobag-mobility',
        category: 'GO_BAG',
        categoryTitle: '15-Minute Evacuation Go-Bag',
        title: 'Mobility Assistance & Accessibility Spare Gear',
        description: 'Spare wheelchair batteries/manual transport chair, folding cane, prescription eyewear backups, hearing aid batteries, and laminated special assistance badge.',
        priority: 'CRITICAL',
        specialHouseholdTag: 'Mobility & Senior Care',
      });
    }

    // --- SECTION 2: HOME HARDENING & UTILITIES ---
    items.push({
      id: 'home-gas-shutoff',
      category: 'HOME_HARDENING',
      categoryTitle: 'Home Hardening & Utility Safety',
      title: 'Main Gas Meter Valve Shut-Off Wrench',
      description: 'Zip-tie a non-sparking 12-inch adjustable wrench or dedicated gas shutoff tool directly to the natural gas meter. Drill all occupants on 1/4-turn shutoff.',
      priority: 'CRITICAL',
    });

    items.push({
      id: 'home-water-electric',
      category: 'HOME_HARDENING',
      categoryTitle: 'Home Hardening & Utility Safety',
      title: 'Main Circuit Breaker & Municipal Water Gate Valve',
      description: 'Clearly tag the main electrical disconnect switch and main domestic water inlet valve. In an evacuation, shut off water to trap clean water in pipes/water heater.',
      priority: 'HIGH',
    });

    // Dwelling-specific hardening
    if (profile.dwellingType === 'apartment') {
      items.push({
        id: 'home-apt-stairwells',
        category: 'HOME_HARDENING',
        categoryTitle: 'Home Hardening & Utility Safety',
        title: 'High-Rise Stairwell & Elevator Interlock Plan',
        description: 'Identify primary and secondary pressurized fire stairwells. Never use elevators during seismic, fire, or flood alerts. Keep doorway wedge and smoke hood ready.',
        priority: 'HIGH',
        specialHouseholdTag: 'High-Rise Apartment',
      });
    } else if (profile.dwellingType === 'mobile_home') {
      items.push({
        id: 'home-mobile-tiedowns',
        category: 'HOME_HARDENING',
        categoryTitle: 'Home Hardening & Utility Safety',
        title: 'Ground Anchor Tie-Downs & Pre-Arranged Shelter',
        description: 'Inspect over-the-top tie-down straps and ground augers. Manufactured homes are vulnerable in winds >50mph; designate a nearby permanent masonry shelter.',
        priority: 'CRITICAL',
        specialHouseholdTag: 'Mobile / Manufactured Home',
      });
    } else if (profile.dwellingType === 'coastal') {
      items.push({
        id: 'home-coastal-surge',
        category: 'HOME_HARDENING',
        categoryTitle: 'Home Hardening & Utility Safety',
        title: 'Coastal Surge Inundation & Vertical Elevation Plan',
        description: 'Map highest interior floor or external vertical concrete evacuation towers. Store battery sump pump and secure outdoor propane tanks with steel chains.',
        priority: 'CRITICAL',
        specialHouseholdTag: 'Coastal Residence',
      });
    }

    // --- SECTION 3: EMERGENCY COMMUNICATIONS & RENDEZVOUS ---
    items.push({
      id: 'comm-out-of-state',
      category: 'COMMUNICATION',
      categoryTitle: 'Family Emergency Communications Plan',
      title: 'Designate Out-of-Area Emergency Contact Person',
      description: 'Designate a family contact outside of your geographic disaster zone. In regional crises, long-distance SMS text messages route faster than local cellular voice circuits.',
      priority: 'CRITICAL',
    });

    items.push({
      id: 'comm-rendezvous-points',
      category: 'COMMUNICATION',
      categoryTitle: 'Family Emergency Communications Plan',
      title: 'Establish 2 Predetermined Meeting Locations',
      description: 'Meeting Point A: Outside front door / street corner (immediate evacuation). Meeting Point B: Specific landmark outside neighborhood (e.g. municipal library, community park).',
      priority: 'CRITICAL',
    });

    items.push({
      id: 'comm-ice-cards',
      category: 'COMMUNICATION',
      categoryTitle: 'Family Emergency Communications Plan',
      title: 'Laminated Wallet ICE (In Case of Emergency) Cards',
      description: 'Place laminated contact cards in all backpacks, wallets, and car glove compartments with blood type, emergency contacts, doctor phone, and allergies.',
      priority: 'HIGH',
    });

    // --- SECTION 4: HAZARD-SPECIFIC ACTION DRILLS ---
    if (selectedHazards.includes('earthquake')) {
      items.push({
        id: 'hazard-earthquake-drill',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Earthquake: Drop, Cover, and Hold On Protocol',
        description: 'Practice taking cover beneath a sturdy table or desk. Anchor bookcases and tall furniture to wall studs with heavy L-brackets. Bolt water heater with steel strapping.',
        priority: 'CRITICAL',
        relevantHazards: ['earthquake'],
      });
    }

    if (selectedHazards.includes('tsunami')) {
      items.push({
        id: 'hazard-tsunami-route',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Tsunami: High-Ground Inundation Evacuation Drill',
        description: 'Walk the foot evacuation route to elevation >= 30 meters (100 feet) or 2 miles inland. If you feel strong shaking near the coast, evacuate immediately without waiting for sirens.',
        priority: 'CRITICAL',
        relevantHazards: ['tsunami'],
      });
    }

    if (selectedHazards.includes('wildfire')) {
      items.push({
        id: 'hazard-wildfire-zone',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Wildfire: 30-Foot Defensible Space & Evacuation Car Staging',
        description: 'Clear dry brush, dead leaves, and pine needles within 30 feet of structure. Back your vehicle into the driveway with keys in the ignition, windows rolled up, and go-bags in trunk.',
        priority: 'CRITICAL',
        relevantHazards: ['wildfire'],
      });
    }

    if (selectedHazards.includes('cyclone')) {
      items.push({
        id: 'hazard-cyclone-shutter',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Cyclone / Hurricane: Storm Shutter & Safe Room Staging',
        description: 'Install impact shutters or pre-cut 5/8-inch marine plywood over all exterior glass. Move family into windowless interior bathroom or reinforced hallway on lowest floor.',
        priority: 'CRITICAL',
        relevantHazards: ['cyclone'],
      });
    }

    if (selectedHazards.includes('flood')) {
      items.push({
        id: 'hazard-flood-barriers',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Flood: Turn Around Don\'t Drown & Sandbag Deployment',
        description: 'Never drive or walk into flooded streets; 6 inches of rapid water knocks down an adult, 12 inches floats a passenger vehicle. Stage sandbags or expandable water-activated flood dams.',
        priority: 'CRITICAL',
        relevantHazards: ['flood'],
      });
    }

    if (selectedHazards.includes('tornado')) {
      items.push({
        id: 'hazard-tornado-shelter',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Tornado: Hardened Safe Shelter & Helmet Protection',
        description: 'Stock basement or interior ground-floor closet with bicycle/motorcycle helmets, steel-toe boots, and heavy wool blankets to protect heads and limbs from airborne projectile debris.',
        priority: 'CRITICAL',
        relevantHazards: ['tornado'],
      });
    }

    if (selectedHazards.includes('volcano')) {
      items.push({
        id: 'hazard-volcano-ash',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Volcano: Ash Fall Infiltration & Eye Protection',
        description: 'Seal building gaps and HVAC air intakes with plastic sheeting and duct tape. Wear airtight goggles and N95 masks; avoid driving as volcanic ash rapidly seizes internal combustion engines.',
        priority: 'CRITICAL',
        relevantHazards: ['volcano'],
      });
    }

    if (selectedHazards.includes('blizzard') || selectedHazards.includes('extreme_temp')) {
      items.push({
        id: 'hazard-winter-pipes',
        category: 'HAZARD_SPECIFIC',
        categoryTitle: 'Local Hazard Drills & Mitigation',
        title: 'Extreme Freeze / Blizzard: Pipe Insulation & Thermal Staging',
        description: 'Insulate exposed plumbing and allow faucets to drip slightly during deep sub-zero conditions. Never use charcoal grills or unvented fuel generators inside living spaces due to carbon monoxide risk.',
        priority: 'HIGH',
        relevantHazards: ['blizzard', 'extreme_temp'],
      });
    }

    // --- SECTION 5: VITAL DOCUMENTS & FINANCIAL CONTINUITY ---
    items.push({
      id: 'doc-waterproof-pouch',
      category: 'DOCUMENTS',
      categoryTitle: 'Vital Documents & Financial Continuity',
      title: 'Waterproof / Fireproof Document Vault Pouch',
      description: 'Store physical passports, government IDs, birth certificates, deeds, titles, and property insurance policies in a sealed silicone fireproof pouch inside your primary go-bag.',
      priority: 'CRITICAL',
    });

    items.push({
      id: 'doc-encrypted-drive',
      category: 'DOCUMENTS',
      categoryTitle: 'Vital Documents & Financial Continuity',
      title: 'Encrypted Digital USB Backup (AES-256)',
      description: 'High-resolution digital scans of all financial accounts, mortgage documents, medical histories, vaccination logs, and home inventory photos stored on an encrypted USB thumb drive.',
      priority: 'HIGH',
    });

    items.push({
      id: 'doc-emergency-cash',
      category: 'DOCUMENTS',
      categoryTitle: 'Vital Documents & Financial Continuity',
      title: 'Emergency Cash Reserve in Small Bills ($1, $5, $10, $20)',
      description: 'Maintain $200–$500 in physical cash divided into small denominations. During regional power grid and telecommunication collapses, electronic credit card POS terminals and ATMs are offline.',
      priority: 'CRITICAL',
    });

    return items;
  }, [profile, selectedHazards]);

  // Checklist completion statistics
  const totalTasks = generatedPlanItems.length;
  const completedTasks = useMemo(() => {
    return generatedPlanItems.filter(item => checkedItems[item.id]).length;
  }, [generatedPlanItems, checkedItems]);
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Toggle checklist item
  const toggleItemCheck = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Reset completed items
  const handleResetChecklist = () => {
    if (confirm('Reset all completed checkmarks in this preparedness plan?')) {
      setCheckedItems({});
    }
  };

  // Mark all as completed
  const handleMarkAllComplete = () => {
    const all: Record<string, boolean> = {};
    generatedPlanItems.forEach(i => (all[i.id] = true));
    setCheckedItems(all);
  };

  // Generate clean, text-based plain text safety plan
  const generatePlainTextPlan = useCallback((): string => {
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const hazardTitles = selectedHazards.map(h => {
      const meta = CALAMITY_METADATA_LIST.find(m => m.id === h);
      return meta ? meta.title : h.toUpperCase();
    }).join(', ');

    let text = '';
    text += `================================================================================\n`;
    text += `         CIVIL DEFENSE PERSONALIZED SAFETY PLAN & PREPAREDNESS CHECKLIST\n`;
    text += `================================================================================\n`;
    text += `LOCATION: ${cityName} (${regionName})\n`;
    text += `COORDINATES: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° W\n`;
    text += `LOCAL DISASTER THREATS: ${hazardTitles}\n`;
    text += `HOUSEHOLD PROFILE: ${profile.size} Person(s) | Dwelling: ${profile.dwellingType.toUpperCase()}`;
    if (profile.hasInfants) text += ` | Infants`;
    if (profile.hasElderly) text += ` | Elderly`;
    if (profile.hasMobilityImpaired) text += ` | Mobility-Impaired`;
    if (profile.hasPets) text += ` | Pets Included`;
    if (profile.hasMedicalNeeds) text += ` | Medical Priority (${profile.medicalNotes || 'Critical Meds'})`;
    text += `\n`;

    if (nearbyActiveHazards.length > 0) {
      text += `\nACTIVE NEARBY CALAMITY THREATS (<850 km):\n`;
      nearbyActiveHazards.slice(0, 3).forEach(h => {
        text += `  • [${h.event.severity}] ${h.event.name} (${h.event.type.toUpperCase()}) - ${h.distanceKm} km away\n`;
      });
    }

    text += `PLAN GENERATED: ${dateFormatted} • Global Disaster Command Network\n`;
    text += `CHECKLIST STATUS: ${completedTasks} of ${totalTasks} Tasks Completed (${progressPercent}% Prepared)\n`;
    text += `================================================================================\n\n`;

    // Group items by category
    const categories: Array<{ id: SafetyPlanItem['category']; title: string }> = [
      { id: 'GO_BAG', title: 'SECTION 1: 15-MINUTE EVACUATION GO-BAG (IMMEDIATE DEPLOYMENT)' },
      { id: 'HOME_HARDENING', title: 'SECTION 2: HOME HARDENING & UTILITY SAFETY PROTOCOLS' },
      { id: 'COMMUNICATION', title: 'SECTION 3: FAMILY EMERGENCY COMMUNICATIONS & RENDEZVOUS' },
      { id: 'HAZARD_SPECIFIC', title: 'SECTION 4: LOCAL HAZARD DRILLS & SECTOR ACTIONS' },
      { id: 'DOCUMENTS', title: 'SECTION 5: VITAL DOCUMENTS & FINANCIAL CONTINUITY VAULT' },
    ];

    categories.forEach(cat => {
      const itemsInCat = generatedPlanItems.filter(i => i.category === cat.id);
      if (itemsInCat.length === 0) return;

      text += `--------------------------------------------------------------------------------\n`;
      text += `${cat.title}\n`;
      text += `--------------------------------------------------------------------------------\n`;

      itemsInCat.forEach((item, idx) => {
        const isDone = !!checkedItems[item.id];
        const box = isDone ? '[X]' : '[ ]';
        text += `${box} ${idx + 1}. [${item.priority}] ${item.title}\n`;
        text += `    Action: ${item.description}\n`;
        if (item.specialHouseholdTag) {
          text += `    Note: Specific to ${item.specialHouseholdTag}\n`;
        }
        text += `\n`;
      });
    });

    text += `================================================================================\n`;
    text += `CIVIL DEFENSE REMINDER:\n`;
    text += `Keep a printed physical copy of this safety plan inside your primary emergency\n`;
    text += `go-bag. During severe grid failures, mobile devices lose power and cellular\n`;
    text += `infrastructure degrades. Review this plan with all household members twice yearly.\n`;
    text += `================================================================================\n`;

    return text;
  }, [
    cityName,
    regionName,
    latitude,
    longitude,
    selectedHazards,
    profile,
    nearbyActiveHazards,
    completedTasks,
    totalTasks,
    progressPercent,
    generatedPlanItems,
    checkedItems,
  ]);

  // Copy plain text plan to clipboard with safe fallback
  const handleCopyTextPlan = async () => {
    const text = generatePlainTextPlan();
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  // Download plain text plan file
  const handleDownloadTextPlan = () => {
    const text = generatePlainTextPlan();
    const cleanCity = cityName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Safety_Plan_${cleanCity}_${new Date().toISOString().substring(0, 10)}.txt`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print plan
  const handlePrint = () => {
    window.print();
  };

  // Filtered plan items for card view
  const displayedPlanItems = useMemo(() => {
    if (activeCategoryFilter === 'ALL') return generatedPlanItems;
    return generatedPlanItems.filter(i => i.category === activeCategoryFilter);
  }, [generatedPlanItems, activeCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* Safety Plan Header Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>CIVIL DEFENSE PREPAREDNESS ENGINE</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">ACTIONABLE SAFETY CHECKLIST</span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 mt-1 flex items-center gap-2.5">
              <ShieldAlert className="w-7 h-7 text-amber-400" />
              Personalized Disaster Safety Plan
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Dynamically generates a customized, text-based survival checklist based on your geographical location,
              dwelling vulnerability, household special needs, and real-time regional natural hazard exposure.
            </p>
          </div>

          {/* Quick Actions (Copy, Download, Print) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyTextPlan}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                copySuccess
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Copy formatted text-based plan to clipboard"
            >
              {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-amber-400" />}
              <span>{copySuccess ? 'Plan Copied!' : 'Copy Text Plan'}</span>
            </button>

            <button
              onClick={handleDownloadTextPlan}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              title="Download text checklist for offline access"
            >
              <Download className="w-4 h-4" />
              <span>Export .TXT Plan</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
              title="Print formatted plan"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Preparedness Score Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">Readiness Score:</span>
              <span className={`text-sm font-black font-mono ${
                progressPercent >= 80 ? 'text-emerald-400' : progressPercent >= 40 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {progressPercent}%
              </span>
            </div>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400 font-mono">
              {completedTasks} of {totalTasks} Tasks Prepared
            </span>
          </div>

          <div className="w-full sm:w-64 bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                progressPercent >= 80 ? 'bg-emerald-500' : progressPercent >= 40 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step 1 & 2 Inputs: Location & Profile Customization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Location & Local Hazard Analysis (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Location Acquisition Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-slate-100">
                  Target Geographic Location
                </h2>
              </div>

              <button
                onClick={handleDetectGPS}
                disabled={isDetectingLocation}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Compass className={`w-3.5 h-3.5 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                <span>{isDetectingLocation ? 'Locating...' : 'Detect GPS'}</span>
              </button>
            </div>

            {locationStatusMsg && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>{locationStatusMsg}</span>
              </div>
            )}

            {/* City & Region text input */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">City / Municipality</label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Region / Country</label>
                <input
                  type="text"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Longitude (°W/E)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Quick Regional Presets */}
            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-2">
                Quick Regional Disaster Zones:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {LOCATION_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                      cityName === preset.name
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="truncate">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Live Calamities Within Proximity Alert */}
            {nearbyActiveHazards.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2">
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{nearbyActiveHazards.length} Active Hazard(s) Within 850 km</span>
                </div>
                <div className="space-y-1">
                  {nearbyActiveHazards.slice(0, 3).map((item) => (
                    <div key={item.event.id} className="text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="truncate max-w-[200px]">
                        • {item.event.name}
                      </span>
                      <span className="font-mono text-rose-400 font-bold text-[10px]">
                        {item.distanceKm} km
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Local Hazards Filter Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-slate-100">
                  Target Disaster Threats
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {selectedHazards.length} Selected
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Select the disaster types common to your sector to tailor the mitigation checklists and drills:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {CALAMITY_METADATA_LIST.map((meta) => {
                const isSelected = selectedHazards.includes(meta.id);
                return (
                  <button
                    key={meta.id}
                    onClick={() => toggleHazard(meta.id)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-slate-600 text-slate-100 shadow-sm'
                        : 'bg-slate-950/60 border-slate-850 text-slate-500 hover:border-slate-800 hover:text-slate-400'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-xs font-semibold truncate">
                      {meta.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Household Profile & Dwelling Attributes (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-100">
                  Household & Dwelling Profile
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Customizes Go-Bag & Hardening Protocol
              </span>
            </div>

            {/* Household Size & Dwelling Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Household Occupants</span>
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, size: num }))}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        profile.size === num
                          ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {num === 6 ? '6+' : num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dwelling Classification</span>
                </label>
                <select
                  value={profile.dwellingType}
                  onChange={(e) => setProfile(p => ({ ...p, dwellingType: e.target.value as HouseholdProfile['dwellingType'] }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="apartment">High-Rise / Multi-Family Apartment</option>
                  <option value="house">Single-Family Detached Home</option>
                  <option value="mobile_home">Manufactured / Mobile Home</option>
                  <option value="coastal">Coastal / Waterfront Property</option>
                  <option value="rural">Rural / Mountain Off-Grid Property</option>
                </select>
              </div>
            </div>

            {/* Special Vulnerabilities Toggles */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                Special Household Considerations:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, hasInfants: !p.hasInfants }))}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    profile.hasInfants
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">👶 Infants / Toddlers</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Formula & Diapers</div>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, hasElderly: !p.hasElderly }))}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    profile.hasElderly
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">👵 Seniors / Elderly</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Care Directives</div>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, hasPets: !p.hasPets }))}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    profile.hasPets
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">🐕 Companion Pets</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Carriers & Rations</div>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, hasMobilityImpaired: !p.hasMobilityImpaired }))}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    profile.hasMobilityImpaired
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold">♿ Mobility Impaired</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Stair Evac Aid</div>
                </button>
              </div>
            </div>

            {/* Medical Dependencies */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.hasMedicalNeeds}
                    onChange={(e) => setProfile(p => ({ ...p, hasMedicalNeeds: e.target.checked }))}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    Essential Prescriptions or Medical Equipment
                  </span>
                </label>
                <span className="text-[10px] text-slate-500">Insulin, Inhalers, Oxygen, CPAP</span>
              </div>

              {profile.hasMedicalNeeds && (
                <input
                  type="text"
                  placeholder="e.g. Daily Insulin + Cold pack, Asthma Inhaler, Blood Pressure Meds"
                  value={profile.medicalNotes}
                  onChange={(e) => setProfile(p => ({ ...p, medicalNotes: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 text-xs"
                />
              )}
            </div>
          </div>

          {/* View Mode Switcher & Checklist Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
            {/* View Mode Toggle: Interactive Cards vs Formatted Text */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('interactive')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'interactive'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Interactive Checklist</span>
              </button>

              <button
                onClick={() => setViewMode('text')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'text'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Formatted Text Plan</span>
              </button>
            </div>

            {/* Checklist Operations */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleMarkAllComplete}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                title="Mark all items as completed"
              >
                Check All
              </button>

              <button
                onClick={handleResetChecklist}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 font-medium transition-colors cursor-pointer flex items-center gap-1"
                title="Reset checklist progress"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist Category Filter Buttons (Interactive Mode) */}
      {viewMode === 'interactive' && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'ALL', label: `All Sections (${generatedPlanItems.length})` },
            { id: 'GO_BAG', label: '15-Min Go-Bag' },
            { id: 'HOME_HARDENING', label: 'Home Hardening' },
            { id: 'COMMUNICATION', label: 'Family Communications' },
            { id: 'HAZARD_SPECIFIC', label: 'Hazard Drills' },
            { id: 'DOCUMENTS', label: 'Vital Documents' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                activeCategoryFilter === cat.id
                  ? 'bg-slate-200 text-slate-900 font-bold shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Plan Display: Either Interactive Cards or Text-Based View */}
      {viewMode === 'interactive' ? (
        <div className="space-y-3">
          {displayedPlanItems.map((item, index) => {
            const isChecked = !!checkedItems[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleItemCheck(item.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                  isChecked
                    ? 'bg-slate-950/80 border-emerald-500/30 text-slate-400'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200 shadow-md'
                }`}
              >
                {/* Checkbox button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItemCheck(item.id);
                  }}
                  className="mt-0.5 text-slate-400 hover:text-amber-400 shrink-0 cursor-pointer"
                >
                  {isChecked ? (
                    <CheckSquare className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500">
                        #{index + 1}
                      </span>
                      <h3 className={`text-sm font-bold ${
                        isChecked ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}>
                        {item.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.specialHouseholdTag && (
                        <span className="text-[10px] font-medium text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded">
                          {item.specialHouseholdTag}
                        </span>
                      )}

                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        item.priority === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                  </div>

                  <p className={`text-xs leading-relaxed ${
                    isChecked ? 'text-slate-500' : 'text-slate-300'
                  }`}>
                    {item.description}
                  </p>

                  <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-2">
                    <span>{item.categoryTitle}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Formatted Monospaced Text Plan View */
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">
                Actionable Text-Based Preparedness Plan Output
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyTextPlan}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <button
                onClick={handleDownloadTextPlan}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .txt</span>
              </button>
            </div>
          </div>

          <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap select-text max-h-[600px] overflow-y-auto">
            {generatePlainTextPlan()}
          </pre>
        </div>
      )}

      {/* Civil Defense Directive Footer */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Synchronized with Global Disaster Command Network • Civil Protection Standard 2026</span>
        </div>
        <div className="font-mono text-[11px] text-slate-500 hidden sm:inline">
          OFFLINE ACTIONABLE DIRECTIVE
        </div>
      </div>
    </div>
  );
};
