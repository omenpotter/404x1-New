import React from "react";
import MatrixRain from "@/components/MatrixRain";

/**
 * @param {Object} props
 * @param {any} props.icon
 * @param {any} props.title
 * @param {any} [props.subtitle]
 * @param {any} [props.footer]
 * @param {any} [props.children]
 */
export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="ds-shell min-h-screen flex items-center justify-center px-4">
      <div className="ds-atmos" aria-hidden="true"><div className="ds-vignette" /><div className="ds-grid" /><MatrixRain /><div className="ds-scan" /></div>
      <main className="relative z-[1] w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4" style={{ boxShadow: "var(--shadow-glow)" }}>
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="ds-h1" style={{ fontSize: "clamp(26px,6vw,34px)" }}>{title}</h1>
          {subtitle && <p className="ds-sub">{subtitle}</p>}
        </div>
        <div className="ds-glass" style={{ padding: 28 }}>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </main>
    </div>
  );
}