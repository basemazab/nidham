// Type shims for npm packages that don't ship their own .d.ts.
// Keep here so they're visible to every .ts file under src/main/.

declare module "electron-squirrel-startup" {
  /**
   * `true` when the current process was launched as a Squirrel hook
   * (--squirrel-install / --squirrel-updated / --squirrel-uninstall etc.).
   * In that case the module has already spawned Update.exe to do the
   * appropriate filesystem work, and the caller should exit.
   */
  const isSquirrelHook: boolean;
  export default isSquirrelHook;
}
