import { VERT_SRC, FRAG_SRC } from './shaders'
import type { ImageLike } from './utils'

export class GlContext {
  readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly vertShader: WebGLShader
  private readonly fragShader: WebGLShader
  private readonly posBuf: WebGLBuffer
  private readonly textures: WebGLTexture[] = []
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>()

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = (
      canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        depth: false,
        stencil: false,
        antialias: false,
      }) ??
      canvas.getContext('experimental-webgl', {
        alpha: true,
        premultipliedAlpha: false,
        depth: false,
        stencil: false,
        antialias: false,
      })
    ) as WebGLRenderingContext | null
    if (!gl) throw new Error('WebGL unavailable')
    this.gl = gl

    this.vertShader  = this.compileShader(VERT_SRC, gl.VERTEX_SHADER)
    this.fragShader  = this.compileShader(FRAG_SRC, gl.FRAGMENT_SHADER)
    this.program     = this.linkProgram(this.vertShader, this.fragShader)
    this.posBuf      = this.buildQuad()
  }

  private compileShader(src: string, type: number): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    return shader
  }

  private linkProgram(vert: WebGLShader, frag: WebGLShader): WebGLProgram {
    const { gl } = this
    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    gl.useProgram(prog)
    return prog
  }

  private buildQuad(): WebGLBuffer {
    const { gl, program } = this
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
      gl.STATIC_DRAW,
    )
    const loc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    return buf
  }

  uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, `u_${name}`))
    }
    return this.uniforms.get(name) ?? null
  }

  set1i(name: string, v: number)          { this.gl.uniform1i(this.uniform(name), v) }
  set1f(name: string, v: number)          { this.gl.uniform1f(this.uniform(name), v) }
  set2f(name: string, a: number, b: number) { this.gl.uniform2f(this.uniform(name), a, b) }
  set3f(name: string, a: number, b: number, c: number) { this.gl.uniform3f(this.uniform(name), a, b, c) }

  createTex(src: ImageLike | null | undefined, unit: number): WebGLTexture | null {
    if (!src) return null
    const { gl } = this
    const tex = gl.createTexture()!
    this.textures.push(tex)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    return tex
  }

  bindTex(tex: WebGLTexture, unit: number): void {
    const { gl } = this
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
  }

  uploadTex(src: ImageLike): void {
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, src)
  }

  draw(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  resize(w: number, h: number): void {
    this.gl.viewport(0, 0, w, h)
  }

  destroy(): void {
    const { gl } = this
    if (gl.isContextLost()) {
      this.textures.length = 0
      this.uniforms.clear()
      return
    }
    this.textures.forEach(t => gl.deleteTexture(t))
    gl.deleteBuffer(this.posBuf)
    gl.deleteProgram(this.program)
    gl.deleteShader(this.vertShader)
    gl.deleteShader(this.fragShader)
    this.textures.length = 0
    this.uniforms.clear()
  }
}
