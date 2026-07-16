import React from "react";
import { Link } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";

export default function PageHeader({ title, subtitle, breadcrumbs = [], actions }) {
  return (
    <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-gray-500 mb-2" data-testid="breadcrumbs">
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              {b.href ? (
                <Link to={b.href} className="hover:text-[#CC0000] transition-colors">{b.label}</Link>
              ) : (
                <span>{b.label}</span>
              )}
              {idx < breadcrumbs.length - 1 && <CaretRight size={10} weight="bold" />}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
