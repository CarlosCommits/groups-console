export function canDismissMutationDialog(pending: boolean) {
  return !pending;
}

export function handleMutationDialogOpenChange(
  nextOpen: boolean,
  pending: boolean,
  onClose: () => void,
) {
  if (!nextOpen && canDismissMutationDialog(pending)) {
    onClose();
  }
}
