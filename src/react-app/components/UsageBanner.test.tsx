import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageBanner } from "@/react-app/components/UsageBanner";

describe("UsageBanner", () => {
  it("does not render when usage is undefined", () => {
    const { container } = render(<UsageBanner label="Chat IA" usage={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when usage is below 80 percent", () => {
    const { container } = render(<UsageBanner label="Chat IA" usage={{ count: 7, limit: 10 }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders warning state near the monthly limit", () => {
    render(<UsageBanner label="Chat IA" usage={{ count: 8, limit: 10 }} />);

    expect(screen.getByText(/Acercándote al límite mensual de Chat IA/i)).toBeInTheDocument();
  });

  it("renders reached state when the monthly limit is exceeded", () => {
    render(<UsageBanner label="Chat IA" usage={{ count: 10, limit: 10 }} />);

    expect(screen.getByText(/Límite mensual alcanzado para Chat IA/i)).toBeInTheDocument();
  });
});