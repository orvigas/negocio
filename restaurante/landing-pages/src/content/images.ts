/**
 * Descriptor inmutable de imagen. width/height son las dimensiones reales del
 * archivo (evitan saltos de diseño). alt vacío = imagen decorativa.
 */
export interface ImageDescriptor {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export function image(src: string, alt: string, width: number, height: number): ImageDescriptor {
  return Object.freeze({ src, alt, width, height });
}
