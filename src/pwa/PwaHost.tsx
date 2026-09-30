/**
 * Mounts the shell-level PWA UI that isn't tied to a single screen. Rendered once by
 * `src/app/Shell.tsx`, outside the `chrome` condition so fullscreen routes (e.g. `#/welcome`)
 * still get it.
 */
import { IOSInstallSheet } from './IOSInstallSheet';

export function PwaHost() {
  return <IOSInstallSheet />;
}

export default PwaHost;
