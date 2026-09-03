declare module 'occt-import-js' {
  interface OcctMeshAttribute {
    array: number[]
  }
  interface OcctMesh {
    attributes: {
      position: OcctMeshAttribute
      normal?: OcctMeshAttribute
    }
    index?: OcctMeshAttribute
  }
  interface OcctResult {
    success: boolean
    meshes: OcctMesh[]
  }
  interface OcctInstance {
    ReadStepFile(buffer: Uint8Array, params: null): OcctResult
  }
  function occtImportJs(options?: { locateFile?: (path: string) => string }): Promise<OcctInstance>
  export default occtImportJs
}
