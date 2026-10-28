/**
 * URL for a file in public/, prefixed with the deploy's basePath.
 *
 * Next adds basePath to <Link> by itself, but not to next/image `src` or to
 * URLs fetched at runtime (GLTFLoader), so `"/praktikum-9/stage-1.glb"` would
 * 404 on GitHub Pages, where the site lives under /GrafikaKomputer.
 */
export function asset(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
