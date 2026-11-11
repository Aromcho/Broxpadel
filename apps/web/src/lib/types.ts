export type Img = { id: number; url: string; w: number; h: number; blur: string | null; dominant: string | null; alt: string | null; variants: { w: number; h: number; url: string }[]; role?: string };
export type VideoSources = { mp4_720?: string; mp4_1080?: string; webm_720?: string; webm_1080?: string; v_mp4?: string; v_webm?: string; h_mp4?: string; h_webm?: string };
export type Video = { id: number; title: string | null; w: number; h: number; duration: number | null; sources: VideoSources; poster: Img | null };
export type Variant = { id: number; size: string; sku: string | null; price: number; stock: number; lowStock: number; active: boolean; available: boolean };
export type SizeGuide = { id: number; name: string; columns: string[]; rows: string[][]; notes: string | null; imageId: number | null };
export type Product = {
  id: number; slug: string; name: string; subtitle: string | null; description: string | null; features: string[];
  price: number; compareAtPrice: number | null; family: string | null; colorName: string | null; colorHex: string | null; colorHex2: string | null;
  garment: 'tee' | 'shorts' | 'socks' | 'other'; featured: boolean; isNew: boolean; visible: boolean; sortOrder: number; createdAt: string; updatedAt: string;
  seoTitle: string | null; seoDescription: string | null; sourceUrl: string | null;
  category: { id: number; slug: string; name: string } | null; collections: { id: number; slug: string; name: string }[];
  images: Img[]; model: { id: number; glb: string; size: number | null; usdz: string | null; usdzId: number | null } | null;
  variants: Variant[]; sizes: string[]; inStock: boolean; totalStock: number;
  reels: { id: number; igUrl: string | null; caption: string | null; startAt: number; video: Video }[];
  sizeGuide: SizeGuide | null;
};
export type Hours = { id: number; day: number; open: string; close: string; note: string | null };
export type Business = {
  name: string; tagline: string | null; description: string | null; legalId: string | null; whatsapp: string | null; phone: string | null; email: string | null;
  instagram: string | null; tiendanube: string | null; address: string | null; city: string | null; province: string | null; lat: number | null; lng: number | null;
  hasStore: boolean; pickupEnabled: boolean; pickupInfo: string | null; transferDiscountPct: number; hasTransferInfo: boolean; installmentsText: string | null;
  shippingText: string | null; announcement: string | null; seoTitle: string | null; seoDescription: string | null; logo: Img | null; hours: Hours[];
};
export type Category = { id: number; slug: string; name: string; description: string | null; cover: Img | null; sortOrder: number };
export type Collection = { id: number; slug: string; name: string; kicker: string | null; description: string | null; cover: Img | null; video: Video | null; featured: boolean };
export type StoryItem = { id: number; kind: 'image' | 'video'; image: Img | null; video: Video | null; caption: string | null; linkLabel: string | null; linkHref: string | null; duration: number };
export type Story = { id: number; title: string; cover: Img | null; items: StoryItem[] };
export type Banner = { id: number; placement: string; kicker: string | null; title: string; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; image: Img | null; video: Video | null };
export type Bootstrap = {
  business: Business; categories: Category[]; collections: Collection[]; stories: Story[]; banners: Banner[]; products: Product[];
  shipping: { id: number; name: string; type: 'pickup' | 'zone'; price: number; freeFrom: number | null; eta: string | null; toQuote: boolean }[];
  courtVideos: Video[]; backgroundVideos: Video[];
  payments: { mercadopago: boolean; mpPublicKey: string | null };
};
