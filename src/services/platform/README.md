# Platform Services

Platform-specific detection and handling services for RUNSTR.

## Files

### PrivacyROMDetectionService.ts
Detects privacy-focused Android ROMs (GrapheneOS, CalyxOS, LineageOS, DivestOS) to help debug sensor-related issues.

**Key Features:**
- Detects ROM type via `NativeModules.PlatformConstants`
- Provides sensor-specific guidance for each ROM
- Caches detection result for performance

**Usage:**
```typescript
import { privacyROMDetectionService } from '../platform/PrivacyROMDetectionService';

const rom = await privacyROMDetectionService.detectROM();
console.log(rom.romType);      // 'grapheneos' | 'calyxos' | 'lineageos' | 'stock'
console.log(rom.isPrivacyROM); // true if privacy ROM detected
console.log(rom.sensorNotes);  // Guidance for enabling sensors (if applicable)
```

**Why This Exists:**
GrapheneOS has a custom `android.permission.OTHER_SENSORS` permission that returns **zeroed sensor data** (not permission errors) when disabled. This makes it difficult to distinguish between "permission denied" and "no data available". The service helps log appropriate guidance when step counts are unexpectedly zero.

## Related Files
- `src/services/activity/DailyStepCounterService.ts` - Uses ROM detection for step counting logs
- `src/services/fitness/healthConnectService.ts` - Health Connect integration
