// The photo URL carries the content hash, so a new photo gets a new URL and the old one can be cached forever.
export const groupPhotoUrl = (slug: string, hash: string | null | undefined) => (hash ? `/${slug}/photo?v=${hash.slice(0, 12)}` : null);
