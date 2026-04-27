import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const windowsIconPath = 'assets/icons/groups-console.ico';
const windowsControlPanelIconUrl =
  'https://raw.githubusercontent.com/CarlosCommits/groups-console/main/assets/icons/groups-console.ico';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'GroupsConsole',
    icon: windowsIconPath,
    extraResource: ['powershell', 'config'],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'GroupsConsole',
      iconUrl: windowsControlPanelIconUrl,
      setupExe: 'GroupsConsoleSetup.exe',
      setupIcon: windowsIconPath,
    }),
    new MakerZIP({}, ['win32']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
