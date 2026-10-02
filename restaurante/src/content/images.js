/**
 * Descriptor inmutable de imagen. width/height son las dimensiones reales del
 * archivo (evitan saltos de diseño). alt vacío = imagen decorativa.
 */
export function image(src, alt, width, height) {
  return Object.freeze({ src, alt, width, height });
}
