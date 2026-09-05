"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";

interface NavItem {
  label: string;
  href: string;
  accent: "yellow" | "blue" | "orange" | "green" | "violet" | "white" | "dark";
  external?: boolean;
}

const navItems: NavItem[] = [
  { label: "how it works", href: "#how-it-works", accent: "yellow" },
  { label: "recovery flow", href: "#how-it-works", accent: "blue" },
  { label: "safety checks", href: "#evidence", accent: "green" },
  { label: "evidence", href: "#evidence", accent: "violet" },
  { label: "operator guide", href: "#how-it-works", accent: "orange" },
];

export function SlushNavbar({ workspace = false }: { workspace?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`nav-w ${scrolled ? "is--scrolled" : ""}`}
      data-scrolling-started={scrolled ? "true" : "false"}
    >
      <div id="navContainer" className="nav-container container">
        <nav className="nav-inner" aria-label="Main Navigation">
          {/* Circular Logo Button */}
          <Link
            href={workspace ? "/command-center" : "/"}
            aria-current="page"
            className="nav-btn-circle is--nav-logo w-inline-block w--current"
            aria-label="Slush Home"
          >
            <BrandLogo className="nav-button-logo" />
          </Link>

          {/* Right Navigation Group */}
          <div className="nav-inner-right">
            <ul role="list" className="nav-inner-list">
              {navItems.map((item) => (
                <li key={item.label} className="nav-inner-li">
                  <a
                    data-button-theme="light"
                    data-button-accent={item.accent}
                    href={workspace ? `/${item.href}` : item.href}
                    className="button-main w-inline-block"
                  >
                    <span className="button-main-inner full-h">
                      <span data-text={item.label} className="button-main-inner__back" />
                      <span className="button-main-inner__front">
                        <span className="button-main-inner__bg" />
                        <span className="button-main-inner__text">
                          <span>{item.label}</span>
                        </span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {/* Cross/Plus Menu Button */}
            <button
              id="menuButton"
              className={`nav-btn-circle ${menuOpen ? "is--open" : ""}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle Menu"
              aria-expanded={menuOpen}
            >
              <div className="nav-btn-menu__lines">
                <div className="nav-btn-menu__line is--h" />
                <div className="nav-btn-menu__line is--v" />
              </div>
            </button>

            {/* Launch App Button */}
            <Link
              data-button-theme="dark"
              data-button-accent="white"
              href={workspace ? "/command-center" : "/login"}
              className="button-main w-inline-block"
            >
              <span className="button-main-inner full-h">
                <span data-text={workspace ? "Command Center" : "Launch App"} className="button-main-inner__back" />
                <span className="button-main-inner__front">
                  <span className="button-main-inner__bg" />
                  <span className="button-main-inner__text">
                  <span>{workspace ? "Command Center" : "Launch App"}</span>
                  </span>
                </span>
              </span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer Overlay */}
      {menuOpen && (
        <div className="nav-mobile-drawer" onClick={() => setMenuOpen(false)}>
          <div className="nav-mobile-drawer-inner" onClick={(e) => e.stopPropagation()}>
            <ul className="nav-mobile-list">
              {navItems.map((item) => (
                <li key={item.label} className="nav-mobile-li">
                  <a
                    href={workspace ? `/${item.href}` : item.href}
                    data-button-theme="light"
                    data-button-accent={item.accent}
                    className="button-main w-inline-block mob-full"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="button-main-inner full-h">
                      <span data-text={item.label} className="button-main-inner__back" />
                      <span className="button-main-inner__front">
                        <span className="button-main-inner__bg" />
                        <span className="button-main-inner__text">
                          <span>{item.label}</span>
                        </span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
              <li className="nav-mobile-li">
                <Link
                  href={workspace ? "/command-center" : "/login"}
                  data-button-theme="dark"
                  data-button-accent="white"
                  className="button-main w-inline-block mob-full"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="button-main-inner full-h">
                    <span data-text={workspace ? "Command Center" : "Launch App"} className="button-main-inner__back" />
                    <span className="button-main-inner__front">
                      <span className="button-main-inner__bg" />
                      <span className="button-main-inner__text">
                      <span>{workspace ? "Command Center" : "Launch App"}</span>
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
