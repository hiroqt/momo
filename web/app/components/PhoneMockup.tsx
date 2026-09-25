import type { ReactNode } from 'react';

export default function PhoneMockup({
  children,
  className = '',
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`phone-mockup-frame ${className}`}>
      <span className="phone-btn phone-btn-silent" aria-hidden="true" />
      <span className="phone-btn phone-btn-vol-up" aria-hidden="true" />
      <span className="phone-btn phone-btn-vol-down" aria-hidden="true" />
      <span className="phone-btn phone-btn-power" aria-hidden="true" />

      <div className="phone-chassis">
        <div className="phone-speaker" aria-hidden="true" />
        <div className="phone-island" aria-hidden="true">
          <span className="island-lens" />
          <span className="island-dot" />
        </div>
        <div className="phone-screen">
          {children}
          <div className="phone-sheen" aria-hidden="true" />
          <div className="phone-home-bar" aria-hidden="true" />
        </div>
      </div>
      {glow && <div className="phone-glow" aria-hidden="true" />}
    </div>
  );
}

