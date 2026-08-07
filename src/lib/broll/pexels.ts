type PexelsVideo = {
  id: number;
  url: string;
  duration: number;
  image: string;
  user?: { name?: string; url?: string };
  video_files: { id: number; quality?: string; file_type?: string; width?: number; height?: number; link: string }[];
};

export async function searchPexelsVideos(query: string, perPage = 3) {
  const key = import.meta.env.VITE_PEXELS_API_KEY as string | undefined;
  if (!key) throw new Error('Pexels API key not configured (VITE_PEXELS_API_KEY)');

  const params = new URLSearchParams({ query, per_page: String(perPage) });
  const url = `https://api.pexels.com/videos/search?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: key,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pexels API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const videos: PexelsVideo[] = json.videos || [];

  return videos.map(v => ({
    id: v.id,
    thumbnailUrl: v.image,
    previewUrl: (v.video_files && v.video_files[0] && v.video_files[0].link) || v.url,
    downloadUrl: (v.video_files && v.video_files[0] && v.video_files[0].link) || v.url,
    attribution: v.user?.name ? `${v.user.name} / Pexels` : 'Pexels',
  }));
}
