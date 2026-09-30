/**
 * The iOS "Add to Home Screen" sheet. There's no native install prompt on iOS Safari, so
 * `useInstallPrompt().promptInstall()` (and the onboarding install step) open this instead via
 * `openIOSInstallSheet()`. Mounted once by `PwaHost` in the shell.
 */
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { closeIOSInstallSheet, useIOSInstallSheetOpen } from './install';
import { IOSInstallSteps } from './IOSInstallSteps';
import s from './IOSInstallSheet.module.css';

export function IOSInstallSheet() {
  const open = useIOSInstallSheetOpen();
  return (
    <BottomSheet open={open} onClose={closeIOSInstallSheet} title="Add us to your home screen">
      <IOSInstallSteps />
      <div className={s.actions}>
        <Button variant="primary" block data-autofocus onClick={closeIOSInstallSheet}>
          Done
        </Button>
        <Button variant="ghost" block onClick={closeIOSInstallSheet}>
          Maybe later
        </Button>
      </div>
    </BottomSheet>
  );
}

export default IOSInstallSheet;
