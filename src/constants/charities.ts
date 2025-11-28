/**
 * Charity Constants
 * Preset charitable organizations that teams can support
 */

export interface Charity {
  id: string;
  name: string;
  displayName: string; // For button labels (e.g., "Zap OpenSats")
  lightningAddress: string;
  description: string;
  website?: string;
}

export const CHARITIES: Charity[] = [
  {
    id: 'opensats',
    name: 'OpenSats',
    displayName: 'OpenSats',
    lightningAddress: 'opensats@vlt.ge',
    description: 'Supporting open source Bitcoin development',
    website: 'https://opensats.org',
  },
  {
    id: 'hrf',
    name: 'Human Rights Foundation',
    displayName: 'The HRF',
    lightningAddress: 'hrf@btcpay.hrf.org',
    description: 'Promoting freedom and human rights worldwide',
    website: 'https://hrf.org',
  },
  {
    id: 'bitcoin-beach',
    name: 'Bitcoin Beach',
    displayName: 'Bitcoin Beach',
    lightningAddress: 'growbitcoinbeach@geyser.fund',
    description: 'Bitcoin circular economy in El Salvador',
    website: 'https://geyser.fund/project/growbitcoinbeach',
  },
  {
    id: 'bitcoin-bay',
    name: 'Bitcoin Bay',
    displayName: 'Bitcoin Bay',
    lightningAddress: 'bitcoinbayfoundation@geyser.fund',
    description: 'Bitcoin circular economy in the Bay Area',
    website: 'https://geyser.fund/project/bitcoinbayfoundation',
  },
  {
    id: 'bitcoin-ekasi',
    name: 'Bitcoin Ekasi',
    displayName: 'Bitcoin Ekasi',
    lightningAddress: 'bitcoinekasi@geyser.fund',
    description: 'Bitcoin circular economy in South Africa',
    website: 'https://geyser.fund/project/bitcoinekasi',
  },
  {
    id: 'bitcoin-isla',
    name: 'Bitcoin Isla',
    displayName: 'Bitcoin Isla',
    lightningAddress: 'btcisla@geyser.fund',
    description: 'Bitcoin circular economy in the Philippines',
    website: 'https://geyser.fund/project/btcisla',
  },
  {
    id: 'bitcoin-valley',
    name: 'Bitcoin Valley',
    displayName: 'Bitcoin Valley',
    lightningAddress: 'bitcoinvalleycirculareconomy@geyser.fund',
    description: 'Bitcoin circular economy in Guatemala',
    website: 'https://geyser.fund/project/bitcoinvalleycirculareconomy',
  },
  {
    id: 'bitcoin-district',
    name: 'Bitcoin District',
    displayName: 'Bitcoin District',
    lightningAddress: 'bitcoindc@geyser.fund',
    description: 'Bitcoin circular economy in Washington DC',
    website: 'https://geyser.fund/project/bitcoindc',
  },
  {
    id: 'bitcoin-yucatan',
    name: 'Bitcoin Yucatan',
    displayName: 'Bitcoin Yucatan',
    lightningAddress: 'bitcoinyucatancommunity@geyser.fund',
    description: 'Bitcoin circular economy in Mexico',
    website: 'https://geyser.fund/project/bitcoinyucatancommunity',
  },
  {
    id: 'bitcoin-veterans',
    name: 'Bitcoin Veterans',
    displayName: 'Bitcoin Veterans',
    lightningAddress: 'operationbitcoin@geyser.fund',
    description: 'Supporting veterans through Bitcoin',
    website: 'https://geyser.fund/project/operationbitcoin',
  },
];

// Helper function to get charity by ID
export const getCharityById = (charityId?: string): Charity | undefined => {
  if (!charityId) return undefined;
  return CHARITIES.find((charity) => charity.id === charityId);
};

// Helper to get charity options for dropdowns
export const getCharityOptions = () => {
  return CHARITIES.map((charity) => ({
    label: charity.name,
    value: charity.id,
  }));
};
