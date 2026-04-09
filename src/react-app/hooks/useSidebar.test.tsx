import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SidebarProvider, useSidebar } from "@/react-app/hooks/useSidebar";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>{children}</SidebarProvider>
);

describe("useSidebar", () => {
  it("initial state is isOpen=false and isCollapsed=false", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isCollapsed).toBe(false);
  });

  it("toggleOpen flips isOpen back and forth", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });

    act(() => result.current.toggleOpen());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.toggleOpen());
    expect(result.current.isOpen).toBe(false);
  });

  it("toggleCollapsed flips isCollapsed", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });

    act(() => result.current.toggleCollapsed());
    expect(result.current.isCollapsed).toBe(true);
  });

  it("closes the mobile menu when window resizes to desktop width", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });

    // Abrir el menú mobile
    act(() => result.current.setIsOpen(true));
    expect(result.current.isOpen).toBe(true);

    // Simular resize a ancho de escritorio (>= 1024px)
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    act(() => { window.dispatchEvent(new Event("resize")); });

    expect(result.current.isOpen).toBe(false);
  });

  it("throws when used outside SidebarProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useSidebar())).toThrow(
      "useSidebar must be used within a SidebarProvider"
    );

    spy.mockRestore();
  });
});
