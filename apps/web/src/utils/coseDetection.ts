export interface CoseDetectionState {
  dialogOpen: boolean
  extensionInstalled: boolean
}

export function isCoseBridgeAvailable(target: unknown): boolean {
  const cose = (target as { $cose?: unknown } | null)?.$cose

  if (cose == null || typeof cose !== `object`) {
    return false
  }

  const bridge = cose as Record<string, unknown>
  return typeof bridge.getAccounts === `function`
    || typeof bridge.getAccountsProgressive === `function`
    || typeof bridge.getPlatforms === `function`
    || typeof bridge.addTask === `function`
}

export function shouldRetryCoseDetection({ dialogOpen, extensionInstalled }: CoseDetectionState): boolean {
  return dialogOpen && !extensionInstalled
}
