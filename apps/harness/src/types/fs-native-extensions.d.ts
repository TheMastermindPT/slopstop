declare module "fs-native-extensions" {
  export function tryLock(
    fd: number,
    offset?: number,
    length?: number,
    options?: Readonly<{ shared?: boolean }>,
  ): boolean;
  export function unlock(fd: number, offset?: number, length?: number): void;
}
