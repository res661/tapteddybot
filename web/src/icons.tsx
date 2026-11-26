import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconTap() {
  return (
    <Icon>
      <path d="M8 11c.5-3 2-6 4.2-6.2C14.5 4.6 15 7 15 9" />
      <path d="M9 11.5V8.8a1.2 1.2 0 0 1 2.4 0V12" />
      <path d="M11.4 11.2V7.6a1.2 1.2 0 0 1 2.4.1V12" />
      <path d="M13.8 11.5V9.2a1.2 1.2 0 0 1 2.3.2v5.2c0 3-2 5.4-5.2 5.4-2.6 0-4.4-1.4-5.2-3.4L7 13.2a1.3 1.3 0 0 1 2.2-.8" />
    </Icon>
  );
}

export function IconUp() {
  return (
    <Icon>
      <path d="M12 19V6" />
      <path d="M6.5 11.5 12 6l5.5 5.5" />
    </Icon>
  );
}

export function IconShop() {
  return (
    <Icon>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </Icon>
  );
}

export function IconClan() {
  return (
    <Icon>
      <path d="M8 18v-5l4-6 4 6v5" />
      <path d="M4 18h16" />
      <path d="M10 18v-3h4v3" />
    </Icon>
  );
}

export function IconTop() {
  return (
    <Icon>
      <path d="M7 20V10" />
      <path d="M12 20V6" />
      <path d="M17 20v-7" />
    </Icon>
  );
}

export function IconFriends() {
  return (
    <Icon>
      <circle cx="9" cy="9" r="2.2" />
      <circle cx="16" cy="10" r="1.8" />
      <path d="M4.8 18c.6-2.4 2.4-3.6 4.2-3.6s3.6 1.2 4.2 3.6" />
      <path d="M13 14.6c1.4-.3 2.8.2 3.6 1.6" />
    </Icon>
  );
}
