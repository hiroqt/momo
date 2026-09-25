import Icon from './Icon';

const stores = [
  { name: 'Google Play', icon: 'playStore', url: process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL },
  { name: 'App Store', icon: 'apple', url: process.env.NEXT_PUBLIC_APP_STORE_URL },
] as const;

export default function StoreButtons({ className = '' }: { className?: string }) {
  return (
    <div className={`store-buttons hero-stores ${className}`} aria-label="Momo mobile app availability">
      {stores.map(({ name, icon, url }) => {
        const content = <>
          <Icon name={icon} size={25} className="hero-store-icon" />
          <span className="hero-store-label"><small>{url ? 'Get it on' : 'Coming soon to'}</small><strong>{name}</strong></span>
        </>;
        const storeClass = `hero-store ${name === 'Google Play' ? 'hero-store-google' : 'hero-store-apple'}`;
        return url
          ? <a key={name} className={storeClass} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Get Momo on ${name}`}>{content}</a>
          : <button key={name} className={storeClass} type="button" disabled aria-label={`${name} — coming soon`}>{content}</button>;
      })}
    </div>
  );
}
