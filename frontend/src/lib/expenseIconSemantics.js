/**
 * Semantic keyword → Lucide icon map (checked before letter fallback).
 * Add entries freely; title words are matched as substrings.
 */
export const semanticIconEntries = [
  { icon: 'Bike', color: '#5C6EAF', keywords: ['bike', 'bicycle', 'cycling', 'motorcycle', 'motor', 'scooter'] },
  { icon: 'Heart', color: '#A8607A', keywords: ['date', 'dating', 'anniversary', 'valentine', 'love', 'romantic', 'crush'] },
  { icon: 'Gamepad2', color: '#7A6BAE', keywords: ['game', 'gaming', 'gamer', 'playstation', 'xbox', 'nintendo', 'dota', 'ml'] },
  { icon: 'Music', color: '#A87090', keywords: ['music', 'concert', 'album', 'karaoke', 'opm'] },
  { icon: 'Book', color: '#5C6EAF', keywords: ['book', 'novel', 'comic', 'manga', 'reading'] },
  { icon: 'Pen', color: '#6B7E8F', keywords: ['pen', 'pencil', 'stationery', 'paper', 'notebook', 'notes'] },
  { icon: 'Camera', color: '#4A72A8', keywords: ['camera', 'photo', 'photography', 'picture', 'selfie'] },
  { icon: 'Phone', color: '#3D8FA0', keywords: ['phone', 'cellphone', 'mobile', 'iphone', 'android', 'sim'] },
  { icon: 'Laptop', color: '#5C6EAF', keywords: ['laptop', 'computer', 'pc', 'macbook', 'monitor', 'keyboard'] },
  { icon: 'Printer', color: '#6B7A7A', keywords: ['print', 'printer', 'photocopy', 'xerox'] },
  { icon: 'Fuel', color: '#B8834A', keywords: ['fuel', 'gasoline', 'diesel', 'gas station', 'petron', 'shell'] },
  { icon: 'Bus', color: '#4A72A8', keywords: ['bus', 'uv express', 'van', 'fx'] },
  { icon: 'Train', color: '#5C6EAF', keywords: ['train', 'mrt', 'lrt', 'pnr'] },
  { icon: 'Ship', color: '#3D8FA0', keywords: ['ferry', 'boat', 'ship', 'roro'] },
  { icon: 'Car', color: '#5C6EAF', keywords: ['car', 'auto', 'vehicle', 'taxi', 'grab car'] },
  { icon: 'Hammer', color: '#6B7A7A', keywords: ['hammer', 'tools', 'construction', 'renovation'] },
  { icon: 'Paintbrush', color: '#7A6BAE', keywords: ['paint', 'art', 'drawing', 'craft'] },
  { icon: 'Flower2', color: '#A8607A', keywords: ['flower', 'flowers', 'bouquet', 'floral'] },
  { icon: 'Cake', color: '#A87090', keywords: ['cake', 'birthday cake', 'bake', 'bakery', 'pastry'] },
  { icon: 'IceCream', color: '#A87090', keywords: ['ice cream', 'dessert', 'gelato', 'sundae'] },
  { icon: 'Beer', color: '#B8834A', keywords: ['beer', 'alcohol', 'wine', 'liquor', 'drinks', 'bar'] },
  { icon: 'Cloud', color: '#6B7E8F', keywords: ['cigarette', 'smoke', 'vape', 'vaping', 'tobacco'] },
  { icon: 'Stethoscope', color: '#A8607A', keywords: ['medical', 'lab', 'xray', 'x-ray', 'dental', 'tooth'] },
  { icon: 'Syringe', color: '#A85870', keywords: ['vaccine', 'injection', 'booster'] },
  { icon: 'Apple', color: '#5A8A72', keywords: ['apple', 'fruit', 'fruits', 'produce'] },
  { icon: 'Drumstick', color: '#A85858', keywords: ['meat', 'beef', 'pork', 'chicken', 'fish', 'seafood'] },
  { icon: 'Egg', color: '#B89A3A', keywords: ['egg', 'itlog'] },
  { icon: 'CupSoda', color: '#4A89A8', keywords: ['milk', 'dairy', 'cheese', 'yogurt'] },
  { icon: 'Pizza', color: '#B8834A', keywords: ['sandwich', 'burger', 'pizza', 'pasta', 'ramen', 'sushi'] },
  { icon: 'Cookie', color: '#9E7A3A', keywords: ['cookie', 'biscuit', 'snacks', 'chips', 'junk food'] },
  { icon: 'ShoppingBag', color: '#7A6BAE', keywords: ['shopping', 'mall', 'boutique', 'retail', 'purchase'] },
  { icon: 'Tag', color: '#5A8A72', keywords: ['sale', 'discount', 'promo', 'deal'] },
  { icon: 'CreditCard', color: '#4A72A8', keywords: ['credit card', 'debit', 'card fee', 'annual fee'] },
  { icon: 'Banknote', color: '#5A8A72', keywords: ['cash', 'atm', 'withdraw', 'withdrawal'] },
  { icon: 'Landmark', color: '#6B7E8F', keywords: ['bank', 'banking', 'loan', 'mortgage', 'interest'] },
  { icon: 'Building', color: '#6B7E8F', keywords: ['office', 'building', 'condo fee', 'hoa', 'association dues'] },
  { icon: 'Sofa', color: '#6B7E8F', keywords: ['furniture', 'sofa', 'bed', 'mattress', 'home decor'] },
  { icon: 'Lamp', color: '#B89A3A', keywords: ['lamp', 'lighting', 'bulb', 'led'] },
  { icon: 'Bath', color: '#4A89A8', keywords: ['shower', 'bathroom', 'soap', 'shampoo', 'hygiene'] },
  { icon: 'Shirt', color: '#7A6BAE', keywords: ['laundry', 'dry clean', 'wash'] },
  { icon: 'Watch', color: '#6B7E8F', keywords: ['watch', 'jewelry', 'ring', 'necklace'] },
  { icon: 'Glasses', color: '#5C6EAF', keywords: ['glasses', 'eyewear', 'optical', 'lens'] },
  { icon: 'Backpack', color: '#5C6EAF', keywords: ['backpack', 'bag', 'luggage', 'travel bag'] },
  { icon: 'Tent', color: '#5A8A72', keywords: ['camping', 'outdoor', 'hiking', 'trek'] },
  { icon: 'Mountain', color: '#5A8A72', keywords: ['mountain', 'resort', 'staycation'] },
  { icon: 'Umbrella', color: '#4A89A8', keywords: ['umbrella', 'rain', 'typhoon'] },
  { icon: 'Sun', color: '#B89A3A', keywords: ['beach', 'summer', 'pool', 'swim', 'swimming'] },
  { icon: 'Church', color: '#6B7E8F', keywords: ['church', 'mass', 'offering', 'donation', 'tithe'] },
  { icon: 'GraduationCap', color: '#5C6EAF', keywords: ['graduation', 'thesis', 'research'] },
  { icon: 'Briefcase', color: '#6B7E8F', keywords: ['work', 'job', 'salary advance', 'uniform', 'work expense'] },
  { icon: 'Users', color: '#4A72A8', keywords: ['family', 'friends', 'party', 'gathering', 'reunion'] },
  { icon: 'Baby', color: '#A87090', keywords: ['infant', 'toddler', 'daycare', 'yaya', 'nanny'] },
  { icon: 'PawPrint', color: '#7A5A35', keywords: ['dog food', 'pet food', 'veterinary', 'vet', 'dog', 'puppy'] },
  { icon: 'PawPrint', color: '#7A5A35', keywords: ['cat food', 'litter', 'cat', 'kitten'] },
  { icon: 'Trees', color: '#5A8A72', keywords: ['plant', 'garden', 'landscaping', 'plants'] },
  { icon: 'Recycle', color: '#5A8A72', keywords: ['recycle', 'trash', 'garbage', 'waste'] },
  { icon: 'Zap', color: '#B89A3A', keywords: ['generator', 'solar', 'inverter'] },
  { icon: 'Wifi', color: '#3D8FA0', keywords: ['modem', 'router', 'isp'] },
  { icon: 'Cloud', color: '#4A89A8', keywords: ['cloud', 'hosting', 'domain', 'server'] },
  { icon: 'Lock', color: '#6B7E8F', keywords: ['security', 'cctv', 'alarm'] },
  { icon: 'Key', color: '#9E7A3A', keywords: ['key', 'duplicate key', 'locksmith'] },
  { icon: 'Ticket', color: '#7A6BAE', keywords: ['ticket', 'raffle', 'lottery', 'bet', 'bingo'] },
  { icon: 'Clapperboard', color: '#7A6BAE', keywords: ['netflix', 'streaming', 'subscription box'] },
  { icon: 'Sparkles', color: '#B89A3A', keywords: ['beauty product', 'skincare', 'makeup', 'cosmetics', 'skincare'] },
  { icon: 'Dumbbell', color: '#4A8A72', keywords: ['protein', 'supplement', 'vitamins', 'gym wear'] },
  { icon: 'HeartPulse', color: '#A85870', keywords: ['therapy', 'counseling', 'mental health'] },
  { icon: 'HandHeart', color: '#A8607A', keywords: ['charity', 'help', 'tip', 'donate', 'donation'] },
  { icon: 'CircleDollarSign', color: '#5A8A72', keywords: ['fee', 'charge', 'payment', 'bill', 'bills'] },
]

export const hashedIconPool = [
  { icon: 'CircleDollarSign', color: '#5A8A72' },
  { icon: 'ShoppingBag', color: '#7A6BAE' },
  { icon: 'Tag', color: '#B8834A' },
  { icon: 'Receipt', color: '#6B7E8F' },
  { icon: 'Wallet', color: '#4A72A8' },
  { icon: 'Package', color: '#5C6EAF' },
  { icon: 'Sparkles', color: '#B89A3A' },
  { icon: 'Star', color: '#9E7A3A' },
  { icon: 'Gem', color: '#7A6BAE' },
  { icon: 'Coins', color: '#9E7A3A' },
  { icon: 'Banknote', color: '#5A8A72' },
  { icon: 'Landmark', color: '#6B7E8F' },
  { icon: 'Coffee', color: '#7A5035' },
  { icon: 'Utensils', color: '#B8834A' },
  { icon: 'Car', color: '#5C6EAF' },
  { icon: 'Bus', color: '#4A72A8' },
  { icon: 'Plane', color: '#4A72A8' },
  { icon: 'Home', color: '#6B7E8F' },
  { icon: 'Zap', color: '#B89A3A' },
  { icon: 'Droplets', color: '#4A89A8' },
  { icon: 'Wifi', color: '#3D8FA0' },
  { icon: 'Smartphone', color: '#3D8FA0' },
  { icon: 'Laptop', color: '#5C6EAF' },
  { icon: 'Gift', color: '#A8607A' },
  { icon: 'Heart', color: '#A8607A' },
  { icon: 'Music', color: '#A87090' },
  { icon: 'Book', color: '#5C6EAF' },
  { icon: 'Bike', color: '#5C6EAF' },
  { icon: 'Dumbbell', color: '#4A8A72' },
  { icon: 'PawPrint', color: '#7A5A35' },
  { icon: 'Baby', color: '#A87090' },
  { icon: 'Wrench', color: '#6B7A7A' },
]

export function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getSemanticIcon(cleanedTitle) {
  if (!cleanedTitle) return null
  const lower = cleanedTitle.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)

  for (const entry of semanticIconEntries) {
    if (entry.keywords.some((k) => lower.includes(k) || words.includes(k))) {
      return { type: 'category', icon: entry.icon, color: entry.color }
    }
  }

  for (const word of words) {
    if (word.length < 3) continue
    for (const entry of semanticIconEntries) {
      if (entry.keywords.some((k) => k === word || k.startsWith(word) || word.startsWith(k))) {
        return { type: 'category', icon: entry.icon, color: entry.color }
      }
    }
  }

  return null
}

export function getHashedLucideIcon(cleanedTitle) {
  const pick = hashedIconPool[hashString(cleanedTitle) % hashedIconPool.length]
  return { type: 'category', icon: pick.icon, color: pick.color }
}
