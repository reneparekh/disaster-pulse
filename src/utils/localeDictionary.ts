import { CalamityEvent, CalamityType } from '../types/disaster';

export interface LocaleInfo {
  code: string;
  languageName: string;
  nativeName: string;
  flag: string;
  direction?: 'ltr' | 'rtl';
}

export interface TranslatedEventData {
  name: string;
  headline: string;
  immediateAction: string;
  interpretation: string;
  locale: LocaleInfo;
  labels: {
    officialSource: string;
    incidentTime: string;
    dataAge: string;
    agencyWarning: string;
    actionRequired: string;
    dataFresh: string;
    dataStale: string;
    locateOnMap: string;
    details: string;
  };
}

/**
 * Mapping of countries to their primary local field response languages
 */
export const COUNTRY_LOCALES: Record<string, LocaleInfo> = {
  Indonesia: {
    code: 'id',
    languageName: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
  },
  Turkey: {
    code: 'tr',
    languageName: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
  },
  Türkiye: {
    code: 'tr',
    languageName: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
  },
  Spain: {
    code: 'es',
    languageName: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
  },
  France: {
    code: 'fr',
    languageName: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
  },
  Philippines: {
    code: 'tl',
    languageName: 'Filipino / Tagalog',
    nativeName: 'Wikang Filipino',
    flag: '🇵🇭',
  },
  Pakistan: {
    code: 'ur',
    languageName: 'Urdu',
    nativeName: 'اردو',
    flag: '🇵🇰',
    direction: 'rtl',
  },
  Somalia: {
    code: 'so',
    languageName: 'Somali',
    nativeName: 'Af-Soomaali',
    flag: '🇸🇴',
  },
  Uganda: {
    code: 'sw',
    languageName: 'Swahili / Luganda',
    nativeName: 'Kiswahili',
    flag: '🇺🇬',
  },
  Tonga: {
    code: 'to',
    languageName: 'Tongan',
    nativeName: 'Lea Faka-Tonga',
    flag: '🇹🇴',
  },
  'Papua New Guinea': {
    code: 'tpi',
    languageName: 'Tok Pisin',
    nativeName: 'Tok Pisin',
    flag: '🇵🇬',
  },
  Japan: {
    code: 'ja',
    languageName: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
  },
  Italy: {
    code: 'it',
    languageName: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
  },
  Mexico: {
    code: 'es',
    languageName: 'Spanish',
    nativeName: 'Español',
    flag: '🇲🇽',
  },
  Chile: {
    code: 'es',
    languageName: 'Spanish',
    nativeName: 'Español',
    flag: '🇨🇱',
  },
  Peru: {
    code: 'es',
    languageName: 'Spanish',
    nativeName: 'Español',
    flag: '🇵🇪',
  },
  Germany: {
    code: 'de',
    languageName: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
  },
  China: {
    code: 'zh',
    languageName: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
  },
  'United States': {
    code: 'es',
    languageName: 'Spanish (Civil Defense)',
    nativeName: 'Español (Protección Civil)',
    flag: '🇺🇸',
  },
  'Global Sentinel (Geneva & Multi-city)': {
    code: 'fr',
    languageName: 'French (UN / WHO)',
    nativeName: 'Français (ONU / OMS)',
    flag: '🇨🇭',
  },
};

export const DEFAULT_LOCALE: LocaleInfo = {
  code: 'es',
  languageName: 'Spanish (Field Standard)',
  nativeName: 'Español',
  flag: '🌐',
};

export function getCountryLocale(country: string): LocaleInfo {
  if (!country) return DEFAULT_LOCALE;
  if (COUNTRY_LOCALES[country]) {
    return COUNTRY_LOCALES[country];
  }
  // Case-insensitive / partial match
  const match = Object.keys(COUNTRY_LOCALES).find(
    c => c.toLowerCase() === country.toLowerCase() || country.toLowerCase().includes(c.toLowerCase())
  );
  return match ? COUNTRY_LOCALES[match] : DEFAULT_LOCALE;
}

/**
 * High-fidelity human-verified translations for key catalog disaster events
 */
const SPECIFIC_EVENT_TRANSLATIONS: Record<string, Record<string, {
  name: string;
  headline: string;
  immediateAction: string;
  interpretation?: string;
}>> = {
  'volc-marapi-01': {
    id: {
      name: 'Letusan Eksplosif Kolom Abu Gunung Marapi',
      headline: 'Peringatan Tingkat III (Siaga): Zona Eksklusi Wajib Radius 4,5 km',
      immediateAction: 'Segera evakuasi seluruh permukiman dalam radius 4,5 km dari puncak kawah. Kenakan masker basah atau respirator tertutup. Tutup seluruh ventilasi, pintu, dan jendela.',
      interpretation: 'Aktivitas erupsi eksplosif tinggi dengan kolom abu mencapai 4.500 m di atas puncak kawah.',
    },
  },
  'tsu-tonga-02': {
    to: {
      name: 'Fakatokanga Tsunami Fakasaikilone \'o e Pasifiki Saute',
      headline: 'Fakatokanga Fakavavevave \'o e Tsunami: Peau Malohi ki he Ngaahi Matāfanga',
      immediateAction: 'Hiki he vave taha ki he ngaahi feitu\'u mā\'olunga \'oku \'ikai si\'i hifo he mita \'e 20. \'Oua \'aupito \'e nofo ofi ki he matāfanga pe ngaahi kauvai.',
      interpretation: 'Ngaahi peau lalahi mo fakatu\'utāmaki \'oku \'unuaki vave mai ki he \'otu motu.',
    },
  },
  'eq-turkey-03': {
    tr: {
      name: 'Doğu Anadolu Fayı Yüzey Kırılması ve Sismik Kayma',
      headline: 'Afet Acil Durum Uyarısı: Şiddetli Yıkım ve Yüksek Artçı Şok Tehlikesi',
      immediateAction: 'Hasarlı binalardan derhal uzaklaşın. Açık güvenli toplanma alanlarına geçin. Acil servis ve ambulans güzergahlarını boş bırakın.',
      interpretation: 'Yüzey kırılması ve derin kabuk sismik boşalmasıyla oluşan ağır yapısal hasar riski.',
    },
  },
  'wf-california-04': {
    es: {
      name: 'Mega-Incendio Forestal de Chaparral Ridge',
      headline: 'Orden de Evacuación Obligatoria Inmediata: Peligro Crítico de Fuego',
      immediateAction: 'Evacúe inmediatamente hacia el norte por la Ruta 299 hacia Redding. No demore la salida para recoger pertenencias.',
      interpretation: 'Comportamiento extremo de fuego impulsado por ráfagas secas con velocidad de propagación crítica.',
    },
  },
  'vir-uganda-05': {
    sw: {
      name: 'Mlipuko wa Virusi vya Ebola vya Sudan Wilayani Mubende',
      headline: 'Tahadhari ya Dharura ya Afya ya Umma: Karantini na Vizuizi vya Usalama',
      immediateAction: 'Epuka kugusana moja kwa moja na wagonjwa au majimaji ya mwili. Osha mikono mara kwa mara na ripoti dalili zozote kwa timu ya afya ya dharura.',
      interpretation: 'Homa ya kutokwa na damu yenye maambukizi ya haraka inayohitaji vizuizi maalum vya matibabu.',
    },
  },
  'ls-png-06': {
    tpi: {
      name: 'Enga Provins Bikpela Tanim Graun Na Malumalu',
      headline: 'Tok Rausim Ol Manmeri: Bikpela Graun I Bruk Na Bagarapim Ples',
      immediateAction: 'Kovap na ranawe i go long maunten antap we graun i strong. Noken i go klostu long ples graun i bruk na kapsait.',
      interpretation: 'Bikpela graun i bruk bikos long hevi ren na pasim rot wantaim ol ples.',
    },
  },
  'av-chamonix-07': {
    fr: {
      name: 'Avalanche de Plaque du Massif du Mont-Blanc',
      headline: 'Alerte Météo-France Risque 5 (Très Fort) d\'Avalanche Spontanée',
      immediateAction: 'Évacuation immédiate des combes et couloirs hors-piste. Restez confinés dans les refuges paravalanches agréés.',
      interpretation: 'Rupture de plaque instable déclenchant des aérosols de neige lourde à plus de 180 km/h.',
    },
  },
  'cyc-manila-08': {
    tl: {
      name: 'Super Typhoon Mawar II Landfall Vector sa Luzon',
      headline: 'PAGASA Babala Blg. 5: Mapanganib na Bugso ng Hangin at Delubyo sa Baybayin',
      immediateAction: 'Agad na lumikas sa mga itinalagang matitibay na evacuation center. Lumayo sa mga dalampasigan dahil sa bantang 5-metrong storm surge.',
      interpretation: 'Mapangwasak na bugso ng hangin na higit sa 285 km/h at laganap na pagbaha.',
    },
  },
  'tor-oklahoma-09': {
    es: {
      name: 'Brote Destructivo de Tornados Cuña Moore-Norman',
      headline: 'Emergencia de Tornado NWS: Impacto Inminente en Zonas Urbanas',
      immediateAction: 'Refúgiese de inmediato en sótano o cuarto interior sin ventanas. Cúbrase la cabeza con colchón o casco protector.',
      interpretation: 'Tornado masivo categoría EF4 con vientos rotacionales superiores a 310 km/h.',
    },
  },
  'fl-valencia-10': {
    es: {
      name: 'Inundación Repentina Catastrófica por DANA en la Cuenca de Valencia',
      headline: 'Aviso Rojo de Emergencia AEMET: Peligro Extremo de Crecida Fluvial',
      immediateAction: 'No utilice vehículos bajo ninguna circunstancia. Suba de inmediato a plantas altas y permanezca alejado de barrancos y cauces.',
      interpretation: 'Avenidas torrenciales extraordinarias por precipitación extrema e inundación relámpago masiva.',
    },
  },
  'dr-somalia-11': {
    so: {
      name: 'Abaarta Ba\'an Ee Gobolka Geeska Afrika',
      headline: 'Digniinta Degdegga Ah: Qalalaasaha Biyaha iyo Badbaadada Dadka & Xoolaha',
      immediateAction: 'U guura goobaha biyaha iyo gargaarka degdegga ah ee la xaqiijiyay. Ka fogaada meelaha ay cudurrada ka dillaaci karaan.',
      interpretation: 'Roob la\'aan ba\'an oo keentay abaar iyo biyo yaraan daran sanado xiriir ah.',
    },
  },
  'bl-buffalo-12': {
    es: {
      name: 'Super Tormenta de Nieve por Efecto Lago en Buffalo',
      headline: 'Prohibición Total de Circulación: Cero Visibilidad y Congelación',
      immediateAction: 'Permanezca bajo techo con calefacción de respaldo. No conduzca bajo ninguna circunstancia.',
      interpretation: 'Ventisca extrema con acumulación de nieve superior a 10 cm por hora y visibilidad nula.',
    },
  },
  'hw-jacobabad-13': {
    ur: {
      name: 'وادی سندھ کی شدید گیلے بلب کی گرمی کی لہر',
      headline: 'قومی ڈیزاسٹر مینجمنٹ الرٹ: جان لیوا شدید گرمی اور ہیٹ اسٹروک کا خطرہ',
      immediateAction: 'براہ راست دھوپ سے مکمل گریز کریں۔ او آر ایس اور ٹھنڈے پانی کا مسلسل استعمال کریں اور سایہ دار میڈیکل کیمپس میں پناہ لیں۔',
      interpretation: 'انتہائی خطرناک ویٹ بلب درجہ حرارت جو انسانی جسم کی قدرتی ٹھنڈک اور پسینے کے نظام کو ناکارہ بنا دیتا ہے۔',
    },
  },
  'pan-h5n1-14': {
    fr: {
      name: 'Surveillance Pandémique Grippe Aviaire H5N1 Clade 2.3.4.4b',
      headline: 'Alerte Mondiale OMS Niveau 4: Transmission Interhumaine Suspectée',
      immediateAction: 'Application stricte des protocoles d\'isolement respiratoire PUI. Port du masque FFP3/N95 et déclaration immédiate de tout cas fébrile.',
      interpretation: 'Surveillance épidémiologique active des foyers de contagion respiratoire interhumaine.',
    },
  },
};

/**
 * Standard translated UI labels across major field responder languages
 */
const LOCALE_UI_LABELS: Record<string, TranslatedEventData['labels']> = {
  id: {
    officialSource: 'Sumber Resmi:',
    incidentTime: 'Waktu Kejadian:',
    dataAge: 'Usia Data:',
    agencyWarning: 'Peringatan Resmi Instansi (Kata-demi-Kata)',
    actionRequired: 'Tindakan Wajib:',
    dataFresh: 'Data Baru (Diperbarui)',
    dataStale: '⚠️ Data Mungkin Usang (> 1 jam)',
    locateOnMap: 'Cari di Peta',
    details: 'Rincian Lengkap',
  },
  tr: {
    officialSource: 'Resmi Kaynak:',
    incidentTime: 'Olay Zamanı:',
    dataAge: 'Veri Yaşı:',
    agencyWarning: 'Resmi Kurum Uyarısı (Birebir Metin)',
    actionRequired: 'Acil Eylem:',
    dataFresh: 'Veri Güncel (Yeni alındı)',
    dataStale: '⚠️ Veri Güncelliğini Yitirmiş Olabilir (> 1 saat)',
    locateOnMap: 'Haritada Bul',
    details: 'Detaylı Bilgi',
  },
  es: {
    officialSource: 'Fuente Oficial:',
    incidentTime: 'Hora del Incidente:',
    dataAge: 'Antigüedad:',
    agencyWarning: 'Aviso Oficial de la Agencia (Literal)',
    actionRequired: 'Acción Requerida:',
    dataFresh: 'Datos Frescos (Actualizados recientemente)',
    dataStale: '⚠️ Datos Desactualizados (> 1 hora)',
    locateOnMap: 'Localizar en Mapa',
    details: 'Detalles',
  },
  fr: {
    officialSource: 'Source Officielle :',
    incidentTime: 'Heure de l\'Événement :',
    dataAge: 'Âge des Données :',
    agencyWarning: 'Alerte Officielle de l\'Agence (Mot à Mot)',
    actionRequired: 'Action Requise :',
    dataFresh: 'Données Récentes (Mise à jour)',
    dataStale: '⚠️ Données Potentiellement Obsolètes (> 1 h)',
    locateOnMap: 'Localiser sur la Carte',
    details: 'Détails Complets',
  },
  tl: {
    officialSource: 'Opisyal na Sanggunian:',
    incidentTime: 'Oras ng Insidente:',
    dataAge: 'Edad ng Datos:',
    agencyWarning: 'Opisyal na Babala ng Ahensya (Eksakto)',
    actionRequired: 'Kailangang Aksyon:',
    dataFresh: 'Sariwang Datos (Kamakailan)',
    dataStale: '⚠️ Maaaring Luma na ang Datos (> 1 oras)',
    locateOnMap: 'Hanapin sa Mapa',
    details: 'Buong Detalye',
  },
  ur: {
    officialSource: 'سرکاری ذریعہ:',
    incidentTime: 'واقعہ کا وقت:',
    dataAge: 'ڈیٹا کی مدت:',
    agencyWarning: 'سرکاری ادارے کی اصل وارننگ',
    actionRequired: 'لازمی کارروائی:',
    dataFresh: 'ڈیٹا بالکل تازہ ہے',
    dataStale: '⚠️ ڈیٹا پرانا ہو سکتا ہے (> 1 گھنٹہ)',
    locateOnMap: 'نقشے پر دیکھیں',
    details: 'مکمل تفصیلات',
  },
  so: {
    officialSource: 'Isha Rasmiga Ah:',
    incidentTime: 'Waqtiga Dhacdada:',
    dataAge: 'Da\'da Xogta:',
    agencyWarning: 'Digniinta Rasmiga Ah Ee Hay\'adda',
    actionRequired: 'Talaabada Degdegga Ah:',
    dataFresh: 'Xog Cusub (La cusbooneysiiyay)',
    dataStale: '⚠️ Xogtu Waa Duug (> 1 saac)',
    locateOnMap: 'Khariidadda Ku Arag',
    details: 'Faahfaahin',
  },
  sw: {
    officialSource: 'Chanzo Rasmi:',
    incidentTime: 'Wakati wa Tukio:',
    dataAge: 'Umri wa Takwimu:',
    agencyWarning: 'Onyo Rasmi la Shirika la Serikali',
    actionRequired: 'Hatua Inayohitajika:',
    dataFresh: 'Takwimu Mpya (Zilizosasishwa)',
    dataStale: '⚠️ Huenda Takwimu zimepitwa na wakati (> saa 1)',
    locateOnMap: 'Tazama kwenye Ramani',
    details: 'Maelezo Zaidi',
  },
  to: {
    officialSource: 'Ma\'u\'anga Fakapule\'anga:',
    incidentTime: 'Taimi Fakalotofonua:',
    dataAge: 'Loloa \'o e Fakamatala:',
    agencyWarning: 'Fakatokanga Fakalao \'a e Potungāue',
    actionRequired: 'Ngaue Fakavavevave:',
    dataFresh: 'Fakamatala Fo\'ou',
    dataStale: '⚠️ Mahalo kuo motu\'a e fakamatala (> houa 1)',
    locateOnMap: 'Kumi \'i he Mape',
    details: 'Ngaahi Fakaikiiki',
  },
  tpi: {
    officialSource: 'Asples Toksave:',
    incidentTime: 'Taim Samting I Kamap:',
    dataAge: 'Taim Bilong Toksave:',
    agencyWarning: 'Toksave Tru Bilong Gavman',
    actionRequired: 'Wok Yu Mas Mekim:',
    dataFresh: 'Nupela Toksave Stret',
    dataStale: '⚠️ Toksave I Olpela Pinis (> 1 aua)',
    locateOnMap: 'Painim Long Mep',
    details: 'Lukim Moa',
  },
  ja: {
    officialSource: '公式情報源:',
    incidentTime: '発生日時:',
    dataAge: 'データ鮮度:',
    agencyWarning: '公的防災機関の緊急警報（原文訳）',
    actionRequired: '緊急避難行動:',
    dataFresh: '最新データ（更新済み）',
    dataStale: '⚠️ データ更新遅延の可能性（1時間以上前）',
    locateOnMap: '地図で位置を確認',
    details: '詳細情報',
  },
};

/**
 * Generic hazard type terms for dynamic feeds (e.g. live USGS/NASA events)
 */
const CALAMITY_TYPE_TRANSLATIONS: Record<string, Record<CalamityType, string>> = {
  id: {
    earthquake: 'Gempa Bumi',
    wildfire: 'Kebakaran Hutan & Lahan',
    volcano: 'Erupsi Gunung Api',
    tsunami: 'Gelombang Tsunami',
    cyclone: 'Siklon Tropis / Badai',
    tornado: 'Puting Beliung / Tornado',
    flood: 'Banjir Bandang & Luapan',
    drought: 'Kekeringan Parah',
    avalanche: 'Longsoran Salju',
    landslide: 'Tanah Longsor',
    blizzard: 'Badai Salju Ekstrem',
    extreme_temp: 'Suhu Panas Ekstrem',
    virus: 'Wabah Virus Infeksi',
    pandemic: 'Pandemi Global',
  },
  tr: {
    earthquake: 'Deprem',
    wildfire: 'Orman Yangını',
    volcano: 'Volkanik Patlama',
    tsunami: 'Tsunami Dalgası',
    cyclone: 'Tropikal Kasırga',
    tornado: 'Hortum / Tornado',
    flood: 'Sel ve Su Baskını',
    drought: 'Şiddetli Kuraklık',
    avalanche: 'Çığ Tehlikesi',
    landslide: 'Heyelan / Toprak Kayması',
    blizzard: 'Tipi ve Kar Fırtınası',
    extreme_temp: 'Aşırı Sıcak Dalgası',
    virus: 'Bulaşıcı Virüs Salgını',
    pandemic: 'Küresel Salgın',
  },
  es: {
    earthquake: 'Terremoto / Sismo',
    wildfire: 'Incendio Forestal',
    volcano: 'Erupción Volcánica',
    tsunami: 'Tsunami',
    cyclone: 'Ciclón / Huracán',
    tornado: 'Tornado Destructivo',
    flood: 'Inundación Fluvial',
    drought: 'Sequía Severa',
    avalanche: 'Avalancha de Nieve',
    landslide: 'Deslizamiento de Tierra',
    blizzard: 'Ventisca Helada',
    extreme_temp: 'Ola de Calor Extremo',
    virus: 'Brote Viral Infeccioso',
    pandemic: 'Pandemia Sanitaria',
  },
  fr: {
    earthquake: 'Séisme / Tremblement de Terre',
    wildfire: 'Feu de Forêt Majeur',
    volcano: 'Éruption Volcanique',
    tsunami: 'Tsunami Côtier',
    cyclone: 'Cyclone / Ouragan',
    tornado: 'Tornade Dévastatrice',
    flood: 'Inondation et Crue Majeure',
    drought: 'Sécheresse Sévère',
    avalanche: 'Avalanche de Plaque',
    landslide: 'Glissement de Terrain',
    blizzard: 'Blizzard Glacial',
    extreme_temp: 'Canicule Extrême',
    virus: 'Foyer Épidémique Viral',
    pandemic: 'Pandémie Sanitaire',
  },
  tl: {
    earthquake: 'Lindol',
    wildfire: 'Sunog sa Kagubatan',
    volcano: 'Pagsabog ng Bulkan',
    tsunami: 'Tsunami sa Baybayin',
    cyclone: 'Bagyo / Bagyong Tropikal',
    tornado: 'Ipo-ipo / Buhawi',
    flood: 'Baha / Pagbaha',
    drought: 'Tagtuyot',
    avalanche: 'Pagguho ng Yelo',
    landslide: 'Pagguho ng Lupa',
    blizzard: 'Malalaking Bagyo ng Yelo',
    extreme_temp: 'Matinding Init',
    virus: 'Pagkalat ng Sakit',
    pandemic: 'Pandaigdigang Pandemya',
  },
};

/**
 * Returns translated event titles, warnings, and field actions for a calamity event
 */
export function translateEventDescription(event: CalamityEvent): TranslatedEventData {
  const locale = getCountryLocale(event.country);
  const labels = LOCALE_UI_LABELS[locale.code] || LOCALE_UI_LABELS.es;

  // 1. Direct verified specific event translation
  const specific = SPECIFIC_EVENT_TRANSLATIONS[event.id]?.[locale.code];
  if (specific) {
    return {
      name: specific.name,
      headline: specific.headline,
      immediateAction: specific.immediateAction,
      interpretation: specific.interpretation || event.intensity.interpretation,
      locale,
      labels,
    };
  }

  // 2. Dynamic synthesis for live feeds & unknown events based on locale vocabulary
  const typeMap = CALAMITY_TYPE_TRANSLATIONS[locale.code] || CALAMITY_TYPE_TRANSLATIONS.es;
  const translatedType = typeMap[event.type] || event.type;

  let dynamicHeadline = event.publicAdvisory?.headline || `${translatedType}: ${event.severity}`;
  let dynamicAction = event.publicAdvisory?.immediateAction || 'Follow official local civil defense instructions.';

  if (locale.code === 'es') {
    dynamicHeadline = `Alerta Oficial (${event.severity}): Peligro Inminente de ${translatedType}`;
    dynamicAction = `Diríjase de inmediato a zonas seguras alejadas del foco de impacto. Siga las órdenes de Protección Civil y mantenga despejadas las rutas de emergencia.`;
  } else if (locale.code === 'id') {
    dynamicHeadline = `Peringatan Resmi (${event.severity}): Ancaman Bahaya ${translatedType}`;
    dynamicAction = `Segera lakukan evakuasi menuju tempat aman yang telah ditentukan oleh BPBD / Basarnas. Pantau radio komunikasi darurat.`;
  } else if (locale.code === 'tr') {
    dynamicHeadline = `Resmi Uyarı (${event.severity}): ${translatedType} Acil Durumu`;
    dynamicAction = `Afet bölgesinden güvenli açık alanlara tahliye olun. AFAD ve acil durum ekiplerinin talimatlarına uyun.`;
  } else if (locale.code === 'fr') {
    dynamicHeadline = `Alerte Officielle (${event.severity}) : Danger Immédiat de ${translatedType}`;
    dynamicAction = `Évacuez immédiatement vers les zones sécurisées identifiées par les services de secours et la préfecture.`;
  } else if (locale.code === 'tl') {
    dynamicHeadline = `Opisyal na Babala (${event.severity}): Panganib ng ${translatedType}`;
    dynamicAction = `Agad na lumikas sa ligtas na lugar alinsunod sa abiso ng lokal na MDRRMO / NDRRMC.`;
  } else if (locale.code === 'ur') {
    dynamicHeadline = `سرکاری ہنگامی الرٹ (${event.severity}): ${translatedType} کا شدید خطرہ`;
    dynamicAction = `فوری طور پر محفوظ مقامات پر منتقل ہوں اور ریسکیو 1122 و ضلعی انتظامیہ کی ہدایات پر عمل کریں۔`;
  }

  return {
    name: `${translatedType} - ${event.city}`,
    headline: dynamicHeadline,
    immediateAction: dynamicAction,
    interpretation: event.intensity.interpretation,
    locale,
    labels,
  };
}
