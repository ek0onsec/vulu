// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RatingSlider } from "@/components/RatingSlider";
import { useState } from "react";

function Harness() {
  const [v, setV] = useState(0);
  return <RatingSlider value={v} onChange={setV} />;
}

describe("RatingSlider", () => {
  it("affiche la valeur littérale en français (virgule)", () => {
    render(<RatingSlider value={4.2} onChange={() => {}} />);
    expect(screen.getByText("4,2/5")).toBeInTheDocument();
  });
  it("le range a min 0 max 5 step 0.1", () => {
    render(<RatingSlider value={2.7} onChange={() => {}} />);
    const range = screen.getByRole("slider") as HTMLInputElement;
    expect(range.min).toBe("0"); expect(range.max).toBe("5"); expect(range.step).toBe("0.1");
  });
  it("notifie le changement", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3.5" } });
    expect(screen.getByText("3,5/5")).toBeInTheDocument();
  });
});
