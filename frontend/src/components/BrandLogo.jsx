function classes(parts) {
  return parts.filter(Boolean).join(' ');
}

export default function BrandLogo({ variant = 'full', className = '', alt = 'Lattice' }) {
  const src = variant === 'icon' ? '/lattice-mark.svg' : '/lattice-logo.svg';
  return (
    <img
      className={classes(['brand-logo', variant === 'icon' ? 'brand-logo--icon' : 'brand-logo--full', className])}
      src={src}
      alt={alt}
    />
  );
}
