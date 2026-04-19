import { describe, expect, it, vi } from "vitest";

import {
  canDismissMutationDialog,
  handleMutationDialogOpenChange,
} from "./mutation-dialog-guard";

describe("mutation dialog guard", () => {
  it("allows dialog dismissal only when no mutation is pending", () => {
    expect(canDismissMutationDialog(false)).toBe(true);
    expect(canDismissMutationDialog(true)).toBe(false);
  });

  it("ignores close attempts while a mutation is pending", () => {
    const onClose = vi.fn();

    handleMutationDialogOpenChange(false, true, onClose);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("runs close handlers when dismissal is allowed", () => {
    const onClose = vi.fn();

    handleMutationDialogOpenChange(false, false, onClose);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
