import * as LucideIcons from 'lucide-vue-next'
import { getSemanticIcon, getHashedLucideIcon } from '@/lib/expenseIconSemantics.js'

// Step 1: Strip wallet/payment words before matching
const walletKeywords = [
  'gcash', 'maya', 'paymaya', 'bpi', 'bdo', 'cash', 'metrobank',
  'unionbank', 'rcbc', 'landbank', 'gotyme', 'shopeepay', 'from',
  'via', 'using', 'thru', 'through', 'wallet', 'paid', 'payment',
  'bayad', 'gamit', 'sa'
]

export function stripWalletWords(title) {
  let cleaned = title.toLowerCase()
  walletKeywords.forEach(word => {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ')
  })
  return cleaned.replace(/\s+/g, ' ').trim()
}

// Layer 1 — Brand Map (Mapped to Domains for Brandfetch)
const brandMap = [


  // Streaming
  { domain: 'netflix.com',    keywords: ['netflix'] },
  { domain: 'spotify.com',    keywords: ['spotify'] },
  { domain: 'youtube.com',    keywords: ['youtube', 'yt premium', 'yt music'] },
  { domain: 'disneyplus.com', keywords: ['disney', 'disney+'] },
  { domain: 'hbo.com',        keywords: ['hbo', 'max'] },
  { domain: 'viu.com',        keywords: ['viu'] },
  { domain: 'amazon.com',     keywords: ['amazon', 'prime'] },

  // E-Wallets & Banks
  { domain: 'gcash.com',        keywords: ['gcash'] },
  { domain: 'maya.ph',          keywords: ['maya', 'paymaya'] },
  { domain: 'gotyme.com.ph',    keywords: ['gotyme', 'go tyme'] },
  { domain: 'bpi.com.ph',       keywords: ['bpi', 'bank of the philippine islands'] },
  { domain: 'bdo.com.ph',       keywords: ['bdo', 'bdo unibank'] },
  { domain: 'coins.ph',         keywords: ['coins.ph'] },
  { domain: 'metrobank.com.ph', keywords: ['metrobank'] },
  { domain: 'securitybank.com', keywords: ['security bank'] },
  { domain: 'unionbankph.com',  keywords: ['unionbank', 'union bank'] },
  { domain: 'rcbc.com',         keywords: ['rcbc'] },
  { domain: 'landbank.com',     keywords: ['landbank', 'land bank'] },

  // Food & Delivery
  { domain: 'grab.com',       keywords: ['grab', 'grabfood', 'grabcar'] },
  { domain: 'foodpanda.com',  keywords: ['foodpanda', 'panda'] },
  { domain: 'angkas.com',     keywords: ['angkas'] },
  { domain: 'joyride.com.ph', keywords: ['joyride', 'joy ride'] },
  { domain: 'moveit.com.ph',  keywords: ['move it', 'moveit'] },
  { domain: 'mcdonalds.com.ph',  keywords: ["mcdonald's", 'mcdo', 'mc do', 'mcdonalds'] },
  { domain: 'starbucks.com',  keywords: ['starbucks'] },
  { domain: 'jollibee.com.ph',keywords: ['jollibee'] },
  { domain: 'kfc.com.ph',     keywords: ['kfc', 'kentucky'] },
  { domain: 'chowkingdelivery.com', keywords: ['chowking'] },
  { domain: 'manginasal.ph',  keywords: ['mang inasal', 'mang-inasal'] },
  { domain: 'pizzahut.com',   keywords: ['pizza hut'] },
  { domain: 'bk.com',         keywords: ['burger king'] },
  { domain: 'dominos.com',    keywords: ["domino's", 'dominos'] },

  // Transportation & Logistics
  { domain: 'lalamove.com',   keywords: ['lalamove'] },
  { domain: 'toktok.ph',      keywords: ['toktok'] },
  { domain: 'cebupacificair.com', keywords: ['cebu pacific', 'ceb pac'] },
  { domain: 'philippineairlines.com', keywords: ['philippine airlines', 'pal'] },

  // Shopping & E-Commerce
  { domain: 'shopee.ph',      keywords: ['shopee'] },
  { domain: 'lazada.com.ph',  keywords: ['lazada'] },
  { domain: 'tiktok.com',     keywords: ['tiktok', 'tiktok shop'] },
  { domain: 'zalora.com.ph',  keywords: ['zalora'] },
  { domain: 'nike.com',       keywords: ['nike'] },
  { domain: 'ikea.com',       keywords: ['ikea'] },
  { domain: 'smsupermalls.com', keywords: ['sm dept', 'sm store', 'sm supermalls'] },
  { domain: 'ayalamalls.com',   keywords: ['ayala malls', 'glorietta', 'trinoma'] },
  { domain: 'robinsonsmalls.com', keywords: ['robinsons'] },
  { domain: 'puregold.com.ph',  keywords: ['puregold'] },
  { domain: 'smmarkets.ph',     keywords: ['savemore', 'sm hypermarket', 'sm supermarket'] },
  { domain: 'mercurydrug.com',  keywords: ['mercury drug'] },
  { domain: 'watsons.com.ph',   keywords: ['watsons'] },
  { domain: '7eleven.com.au',   keywords: ['7 eleven', '7eleven', '7-eleven', 'seven eleven'] },

  // Telecoms & Water
  { domain: 'globe.com.ph',   keywords: ['globe load', 'globe bill', 'globe subscription', 'globe'] },
  { domain: 'smart.com.ph',   keywords: ['smart load', 'smart bill', 'smart subscription', 'smart communications', 'smart'] },
  { domain: 'dito.ph',        keywords: ['dito', 'dito telecommunity'] },
  { domain: 'pldthome.com',   keywords: ['pldt', 'pldt home'] },
  { domain: 'convergeict.com',keywords: ['converge', 'converge ict', 'converge ict solutions'] },
  { domain: 'meralco.com.ph', keywords: ['meralco'] },
  { domain: 'mayniladwater.com.ph', keywords: ['maynilad'] },
  { domain: 'manilawater.com',keywords: ['manila water'] },

  // Tech & Subscriptions
  { domain: 'google.com',     keywords: ['google one', 'google drive', 'gdrive', 'google storage'] },
  { domain: 'apple.com',      keywords: ['icloud', 'app store', 'apple music', 'apple one'] },
  { domain: 'microsoft.com',  keywords: ['microsoft', 'office 365', 'm365', 'teams'] },
  { domain: 'adobe.com',      keywords: ['adobe', 'photoshop', 'illustrator', 'premiere'] },
  { domain: 'canva.com',      keywords: ['canva'] },
  { domain: 'openai.com',     keywords: ['chatgpt', 'openai', 'chat gpt'] },
  { domain: 'github.com',     keywords: ['github'] },
  { domain: 'notion.so',      keywords: ['notion'] },
  { domain: 'figma.com',      keywords: ['figma'] },

  // Gaming
  { domain: 'steampowered.com', keywords: ['steam'] },
  { domain: 'playstation.com',keywords: ['playstation', 'psn', 'ps5', 'ps4'] },
  { domain: 'roblox.com',     keywords: ['roblox'] },
  { domain: 'epicgames.com',  keywords: ['epic games', 'fortnite'] },

  // Travel
  { domain: 'airbnb.com',     keywords: ['airbnb'] },
  { domain: 'uber.com',       keywords: ['uber'] },
  { domain: 'agoda.com',      keywords: ['agoda'] },
  { domain: 'booking.com',    keywords: ['booking.com'] },
]

function getBrandIcon(cleanedTitle) {
  const lower = cleanedTitle.toLowerCase()
  const match = brandMap.find(b => b.keywords.some(k => lower.includes(k)))
  if (!match) return null

  // Use Logo.dev CDN URL. It requires the VITE_LOGODEV_PUBLISHABLE_KEY from environment.
  const token = import.meta.env.VITE_LOGODEV_PUBLISHABLE_KEY
  const iconUrl = token 
    ? `https://img.logo.dev/${match.domain}?token=${token}&retina=true`
    : `https://img.logo.dev/${match.domain}?retina=true` // fallback if token isn't set yet

  return { type: 'brand', url: iconUrl, title: match.domain }
}

// Layer 2 — Category Map
const categoryMap = [
  {
    icon: 'ShoppingCart', color: '#5A8A72',
    keywords: [
      'grocery', 'groceries', 'palengke', 'supermarket', 'wet market',
      'sm', 'robinsons', 'puregold', 'savemore', 'market', 'bilihan',
      'pamilihan'
    ],
  },
  {
    icon: 'Utensils', color: '#B8834A',
    keywords: [
      'food', 'kain', 'pagkain', 'pagkaon', 'lunch', 'dinner', 'breakfast',
      'merienda', 'snack', 'ulam', 'restaurant', 'eatery', 'carenderia',
      'softdrink', 'drinks', 'inumin', 'buko', 'sago', 'halo halo',
      'ihaw', 'bbq', 'barbecue', 'lutong', 'niluto', 'meal', 'rice',
      'kanin', 'gutom', 'kaon'
    ],
  },
  {
    icon: 'Car', color: '#5C6EAF',
    keywords: [
      'gas', 'fuel', 'petrol', 'gasolina', 'transport', 'angkas',
      'jeep', 'jeepney', 'bus', 'mrt', 'lrt', 'tricycle', 'trike',
      'habal', 'toll', 'parking', 'commute', 'byahe', 'sakay',
      'sakyanan', 'fare', 'pamasahe'
    ],
  },
  {
    icon: 'Pill', color: '#A8607A',
    keywords: [
      'medicine', 'gamot', 'mercury', 'watsons', 'rose pharmacy',
      'hospital', 'clinic', 'checkup', 'doctor', 'dentist',
      'pharmacy', 'vitamins', 'botika', 'medisina', 'health',
      'kalusugan', 'ospital', 'konsulta'
    ],
  },
  {
    icon: 'Shirt', color: '#7A6BAE',
    keywords: [
      'clothes', 'damit', 'sapatos', 'shoes', 'shirt', 'pants',
      'dress', 'bag', 'divisoria', 'ukay', 'fashion', 'outfit',
      'pantalon', 'tsinelas', 'sandals', 'socks', 'medyas',
      'underwear', 'bra', 'accessories', 'jewelry', 'alahas'
    ],
  },
  {
    icon: 'Zap', color: '#B89A3A',
    keywords: [
      'electricity', 'kuryente', 'electric', 'power bill',
      'light bill', 'ilaw', 'electric bill'
    ],
  },
  {
    icon: 'Droplets', color: '#4A89A8',
    keywords: [
      'water', 'tubig', 'maynilad', 'manila water', 'water bill',
      'water refill', 'mineral water'
    ],
  },
  {
    icon: 'Wifi', color: '#3D8FA0',
    keywords: [
      'internet', 'wifi', 'sky cable',
      'subscription', 'load', 'data', 'prepaid', 'postpaid',
      'broadband', 'fiber'
    ],
  },
  {
    icon: 'Home', color: '#6B7E8F',
    keywords: [
      'rent', 'upa', 'boarding', 'condo', 'apartment', 'dorm',
      'house', 'bahay', 'kwarto', 'abang', 'renta', 'tolda'
    ],
  },
  {
    icon: 'GraduationCap', color: '#5C6EAF',
    keywords: [
      'school', 'tuition', 'education', 'supplies', 'notebook',
      'books', 'baon', 'allowance', 'iskwela', 'paaralan',
      'enrollment', 'miscellaneous fee', 'school fee', 'review',
      'tutorial'
    ],
  },
  {
    icon: 'Scissors', color: '#A85870',
    keywords: [
      'haircut', 'salon', 'gupit', 'parlor', 'beauty', 'nails',
      'spa', 'massage', 'facial', 'pabango', 'perfume', 'grooming',
      'barbershop', 'barber'
    ],
  },
  {
    icon: 'Dumbbell', color: '#4A8A72',
    keywords: ['gym', 'fitness', 'workout', 'exercise', 'sports'],
  },
  {
    icon: 'Plane', color: '#4A72A8',
    keywords: [
      'travel', 'flight', 'airline', 'cebu pacific', 'pal',
      'philippine airlines', 'airasia', 'hotel', 'resort',
      'bakasyon', 'biyahe', 'pasaporte', 'visa fee', 'tour'
    ],
  },
  {
    icon: 'Coffee', color: '#7A5035',
    keywords: [
      'coffee', 'cafe', 'kape', "bo's coffee", 'tim horton',
      'coffee bean', 'dunkin', 'milk tea', 'boba', 'chatime',
      'gong cha', 'coco'
    ],
  },
  {
    icon: 'HandCoins', color: '#9E7A3A',
    keywords: [
      'lent', 'utang', 'debt', 'borrowed', 'padala', 'remittance',
      'send money', 'ipadala', 'pautang', 'hulog', 'installment',
      'bayad utang'
    ],
  },
  {
    icon: 'PiggyBank', color: '#5A8A72',
    keywords: ['savings', 'ipon', 'deposit', 'investment', 'paluwagan'],
  },
  {
    icon: 'Gift', color: '#A8607A',
    keywords: [
      'gift', 'regalo', 'present', 'birthday', 'kaarawan',
      'pasalubong', 'christmas', 'pasko', 'pamaskong handog'
    ],
  },
  {
    icon: 'Baby', color: '#A87090',
    keywords: [
      'baby', 'diaper', 'lampin', 'formula', 'pampers', 'milk',
      'gatas', 'baby needs', 'baby stuff'
    ],
  },
  {
    icon: 'PawPrint', color: '#7A5A35',
    keywords: ['pet', 'dog', 'cat', 'vet', 'animal', 'aso', 'pusa', 'alaga'],
  },
  {
    icon: 'Wrench', color: '#6B7A7A',
    keywords: [
      'repair', 'fix', 'ayos', 'maintenance', 'plumber', 'tubero',
      'electrician', 'carpenter', 'karpintero', 'hardware'
    ],
  },
  {
    icon: 'Tv', color: '#7A6BAE',
    keywords: [
      'movie', 'cinema', 'sm cinema', 'ayala cinemas', 'entertainment',
      'concert', 'show', 'event', 'ticket'
    ],
  },
]

function getCategoryIcon(cleanedTitle) {
  const lower = cleanedTitle.toLowerCase()
  const match = categoryMap.find(c => c.keywords.some(k => lower.includes(k)))
  if (!match) return null
  return { type: 'category', icon: match.icon, color: match.color }
}

export function getLetterAvatar(cleanedTitle) {
  if (!cleanedTitle) return null
  
  // Use first alphanumeric character, otherwise return null to use the final fallback
  const firstLetter = cleanedTitle.replace(/[^a-zA-Z0-9]/g, '').charAt(0)
  if (!firstLetter) return null

  // Muted, sophisticated color palette for letter avatars
  const colors = [
    '#A85858', '#B8834A', '#9E7A3A', '#5A8A72', '#3D8FA0',
    '#4A72A8', '#5C6EAF', '#7A6BAE', '#A8607A', '#A85870'
  ]
  let hash = 0
  for (let i = 0; i < cleanedTitle.length; i++) {
    hash = cleanedTitle.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = colors[Math.abs(hash) % colors.length]

  return { type: 'letter', letter: firstLetter.toUpperCase(), color }
}

function getDynamicLucideIcon(cleanedTitle) {
  if (!cleanedTitle) return null
  const words = cleanedTitle.toLowerCase().split(/\s+/).filter(Boolean)
  const iconNames = Object.keys(LucideIcons)
  
  for (const word of words) {
    if (word.length < 3) continue
    
    // Find exact or partial match in icon names
    const match = iconNames.find(name => {
      const lowerName = name.toLowerCase()
      return lowerName === word || lowerName.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).includes(word) || lowerName.includes(word)
    })
    
    if (match) {
      const colors = [
        '#A85858', '#B8834A', '#9E7A3A', '#5A8A72', '#3D8FA0',
        '#4A72A8', '#5C6EAF', '#7A6BAE', '#A8607A', '#A85870',
        '#6B7E8F', '#B89A3A', '#4A89A8'
      ]
      let hash = 0
      for (let i = 0; i < match.length; i++) {
        hash = match.charCodeAt(i) + ((hash << 5) - hash)
      }
      const color = colors[Math.abs(hash) % colors.length]
      
      return { type: 'category', icon: match, color }
    }
  }
  return null
}

const fallback = { type: 'fallback', icon: 'Receipt', color: '#8A9BAA' }

export function useExpenseIcon(title) {
  if (!title) return fallback
  const cleaned = stripWalletWords(title)
  return (
    getBrandIcon(cleaned) ??
    getCategoryIcon(cleaned) ??
    getSemanticIcon(cleaned) ??
    getDynamicLucideIcon(cleaned) ??
    getLetterAvatar(cleaned) ??
    getHashedLucideIcon(cleaned) ??
    fallback
  )
}

