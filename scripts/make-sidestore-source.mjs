#!/usr/bin/env node
// Writes the SideStore/AltStore "source" JSON that points SideStore at the latest IPA.
//
// Run by .github/workflows/ios-build.yml after each build. All inputs come from env vars so
// the workflow stays readable:
//
//   SOURCE_URL      stable URL SideStore fetches this file from
//   ICON_URL        app icon (PNG)
//   IPA_URL         download URL of this build's .ipa (a GitHub release asset)
//   IPA_PATH        local path to the .ipa, used for its byte size
//   APP_VERSION     CFBundleShortVersionString stamped into the build, e.g. 1.0.42
//   BUILD_NUMBER    CFBundleVersion stamped into the build, e.g. 42
//   RUNTIME_VERSION expo-updates fingerprint of the build (shown in the notes)
//   COMMIT_SHA      commit the build was made from
//   INFO_PLIST_JSON optional: the built app's Info.plist as JSON (plutil -convert json).
//                   Used for the privacy keys and to check the stamped version.
//   OUT             where to write the JSON (default: source.json)
//
// SideStore refuses to install if `version`/`buildVersion` here differ from the IPA's
// CFBundleShortVersionString/CFBundleVersion, and only offers an update when the x.y.z
// `version` is HIGHER than the installed one (buildVersion alone is ignored). Hence the
// workflow's 1.0.<run number> scheme. Don't add `marketplaceID`: SideStore rejects it.

import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`make-sidestore-source: missing env var ${name}`);
    process.exit(1);
  }
  return value;
}

const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const deploymentTarget =
  appJson.plugins
    ?.find((p) => Array.isArray(p) && p[0] === 'expo-build-properties')?.[1]?.ios
    ?.deploymentTarget ?? '17.0';

const sourceUrl = required('SOURCE_URL');
const iconUrl = required('ICON_URL');
const ipaUrl = required('IPA_URL');
const ipaPath = required('IPA_PATH');
const size = statSync(ipaPath).size;
// SideStore verifies the download against this when present.
const sha256 = createHash('sha256').update(readFileSync(ipaPath)).digest('hex');
const version = required('APP_VERSION');
const buildVersion = required('BUILD_NUMBER');
const runtimeVersion = process.env.RUNTIME_VERSION?.trim() || 'n/a';
const commit = (process.env.COMMIT_SHA?.trim() || 'unknown').slice(0, 7);
const date = new Date().toISOString();
const notes = `Build ${buildVersion} from ${commit}. Native runtime ${runtimeVersion.slice(0, 12)}.`;

// Prefer the built Info.plist: config plugins (e.g. expo-media-library) add usage keys that
// are not in app.json, and the source's permissions should describe the real binary.
const builtPlistPath = process.env.INFO_PLIST_JSON?.trim();
const builtPlist = builtPlistPath ? JSON.parse(readFileSync(builtPlistPath, 'utf8')) : null;
if (builtPlist && builtPlist.CFBundleShortVersionString !== version) {
  console.error(
    `make-sidestore-source: IPA version ${builtPlist.CFBundleShortVersionString} != APP_VERSION ${version}; SideStore would refuse to install it.`,
  );
  process.exit(1);
}
const privacy = Object.fromEntries(
  Object.entries(builtPlist ?? appJson.ios?.infoPlist ?? {}).filter(([key]) =>
    /^NS.*UsageDescription$/.test(key),
  ),
);

const app = {
  name: appJson.name,
  bundleIdentifier: appJson.ios.bundleIdentifier,
  developerName: 'Vintage Digi',
  subtitle: 'Local-only vintage camera',
  localizedDescription:
    'A local-only vintage camera. No backend, no accounts. JS changes arrive over the air; this source delivers native rebuilds.',
  iconURL: iconUrl,
  tintColor: '#E8B54A',
  category: 'photo-video',
  screenshots: [],
  versions: [
    {
      version,
      buildVersion,
      date,
      localizedDescription: notes,
      downloadURL: ipaUrl,
      size,
      sha256,
      minOSVersion: deploymentTarget,
    },
  ],
  appPermissions: {
    // An unsigned build carries no entitlements; SideStore adds its own when it signs.
    entitlements: [],
    privacy,
  },
  // Legacy single-version fields, still read by older SideStore releases.
  version,
  versionDate: date,
  versionDescription: notes,
  downloadURL: ipaUrl,
  size,
};

const source = {
  name: 'Vintage Digi',
  identifier: `${appJson.ios.bundleIdentifier}.source`,
  sourceURL: sourceUrl,
  subtitle: 'Personal builds of Vintage Digi',
  iconURL: iconUrl,
  tintColor: '#E8B54A',
  apps: [app],
  news: [],
};

const out = process.env.OUT?.trim() || 'source.json';
writeFileSync(out, `${JSON.stringify(source, null, 2)}\n`);
console.log(`Wrote ${out}: ${app.name} ${version} (${buildVersion}), ${size} bytes`);
