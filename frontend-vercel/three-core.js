import * as THREE from 'three';

const DEFAULTS = Object.freeze({
  BackgroundScene: 'core-network-mesh',
  AnimationIntensity: 'NORMAL',
  BackgroundOpacity: 33,
  MouseParallax: true,
  DataFlow: true,
  ReduceMotionMobile: true
});

const intensityScale = {
  LOW: 0.58,
  NORMAL: 1,
  HIGH: 1.55
};

const prefersReducedMotion =
  window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

const isMobile = () =>
  window.matchMedia(
    '(max-width: 767px)'
  ).matches;


function supportsWebGL() {
  try {
    const canvas =
      document.createElement('canvas');

    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl')
    );
  } catch (_) {
    return false;
  }
}


function normalizePrefs(input) {
  const p =
    Object.assign(
      {},
      DEFAULTS,
      input || {}
    );

  p.BackgroundOpacity =
    Math.max(
      0,
      Math.min(
        60,
        Number(p.BackgroundOpacity) || 0
      )
    );

  p.AnimationIntensity =
    intensityScale[
      String(
        p.AnimationIntensity
      ).toUpperCase()
    ]
      ? String(
          p.AnimationIntensity
        ).toUpperCase()
      : 'NORMAL';

  p.MouseParallax =
    p.MouseParallax === true ||
    String(p.MouseParallax) === 'true';

  p.DataFlow =
    p.DataFlow === true ||
    String(p.DataFlow) === 'true';

  p.ReduceMotionMobile =
    p.ReduceMotionMobile === true ||
    String(p.ReduceMotionMobile) === 'true';

  return p;
}


class AppSceneEngine {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.root = null;
    this.dynamic = [];
    this.packetSystems = [];
    this.pointer = { x: 0, y: 0 };
    this.page = 'dashboard';
    this.prefs =
      normalizePrefs(
        window.MLNAppearancePreferences
      );

    this.clock =
      new THREE.Clock();

    this.init();
  }

  init() {
    if (
      !this.container ||
      !supportsWebGL()
    ) {
      this.container?.classList.add(
        'three-core-fallback'
      );

      return;
    }

    this.scene =
      new THREE.Scene();

    this.camera =
      new THREE.PerspectiveCamera(
        48,
        1,
        0.1,
        120
      );

    this.camera.position.set(
      0,
      0,
      9.4
    );

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: !isMobile(),
        alpha: true,
        powerPreference:
          'high-performance'
      });

    this.renderer.setClearColor(
      0x000000,
      0
    );

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        isMobile() ? 1 : 1.5
      )
    );

    this.renderer.domElement.className =
      'three-core-canvas';

    this.container.appendChild(
      this.renderer.domElement
    );

    this.resizeObserver =
      new ResizeObserver(
        () => this.resize()
      );

    this.resizeObserver.observe(
      this.container
    );

    window.addEventListener(
      'pointermove',
      event => {
        if (
          !this.prefs.MouseParallax
        ) {
          return;
        }

        const rect =
          this.container
            .getBoundingClientRect();

        if (
          !rect.width ||
          !rect.height
        ) {
          return;
        }

        this.pointer.x =
          (
            (
              event.clientX -
              rect.left
            ) /
            rect.width
          ) * 2 - 1;

        this.pointer.y =
          -(
            (
              (
                event.clientY -
                rect.top
              ) /
              rect.height
            ) * 2 - 1
          );
      },
      {
        passive:true
      }
    );

    this.resize();
    this.rebuild();
    this.animate();
  }

  setPage(page) {
    this.page =
      String(page || '');

    this.applyOpacity();
  }

  setPreferences(input) {
    this.prefs =
      normalizePrefs(input);

    this.rebuild();
    this.applyOpacity();
  }

  applyOpacity() {
    if (!this.container) return;

    if (
      this.prefs.BackgroundScene ===
      'off'
    ) {
      this.container.style.opacity =
        '0';

      return;
    }

    let opacity =
      this.prefs.BackgroundOpacity /
      100;

    if (
      this.page !== 'dashboard'
    ) {
      opacity *= 0.43;
    }

    if (
      isMobile() &&
      this.prefs.ReduceMotionMobile
    ) {
      opacity *= 0.42;
    }

    this.container.style.opacity =
      String(
        Math.max(
          0,
          Math.min(
            0.6,
            opacity
          )
        )
      );
  }

  clearScene() {
    this.dynamic = [];
    this.packetSystems = [];

    if (this.root) {
      this.scene.remove(
        this.root
      );

      this.root.traverse(
        object => {
          if (object.geometry) {
            object.geometry.dispose();
          }

          if (object.material) {
            if (
              Array.isArray(
                object.material
              )
            ) {
              object.material.forEach(
                m => m.dispose()
              );
            } else {
              object.material.dispose();
            }
          }
        }
      );
    }

    this.root =
      new THREE.Group();

    this.scene.add(
      this.root
    );
  }

  rebuild() {
    if (!this.scene) return;

    this.clearScene();

    const name =
      this.prefs.BackgroundScene;

    const builders = {
      'network-globe':
        () => this.buildGlobe(),
      'core-network-mesh':
        () => this.buildMesh(),
      'cyber-grid':
        () => this.buildCyberGrid(),
      'data-stream':
        () => this.buildDataStream(),
      'network-topology':
        () => this.buildTopology(false),
      'data-center-core':
        () => this.buildServerMatrix(true),
      'pop-network-map':
        () => this.buildPopMap(),
      'fiber-backbone':
        () => this.buildFiber(),
      'incident-alert':
        () => this.buildTopology(true),
      'digital-city-nodes':
        () => this.buildCity(),
      'particle-field':
        () => this.buildParticleField(),
      'hex-tech-grid':
        () => this.buildHexGrid(),
      'radar-core':
        () => this.buildRadar(),
      'orbital-core':
        () => this.buildOrbital(),
      'server-matrix':
        () => this.buildServerMatrix(false),
      'off':
        () => {}
    };

    (
      builders[name] ||
      builders[
        'core-network-mesh'
      ]
    )();

    this.applyOpacity();
  }

  pointMaterial(
    color,
    size,
    opacity = 1
  ) {
    return new THREE.PointsMaterial({
      color,
      size,
      transparent:true,
      opacity,
      sizeAttenuation:true,
      depthWrite:false,
      blending:
        THREE.AdditiveBlending
    });
  }

  lineMaterial(
    color,
    opacity = 0.16
  ) {
    return new THREE.LineBasicMaterial({
      color,
      transparent:true,
      opacity,
      depthWrite:false,
      blending:
        THREE.AdditiveBlending
    });
  }

  randomPoints(
    count,
    sx,
    sy,
    sz
  ) {
    const points = [];

    for (
      let i = 0;
      i < count;
      i++
    ) {
      points.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * sx,
          (Math.random() - 0.5) * sy,
          (Math.random() - 0.5) * sz
        )
      );
    }

    return points;
  }

  connect(
    points,
    maxDistance,
    maxNeighbors = 2,
    color = 0x268dce,
    opacity = 0.12
  ) {
    const positions = [];
    const pairs = [];

    for (
      let i = 0;
      i < points.length;
      i++
    ) {
      const neighbors = [];

      for (
        let j = i + 1;
        j < points.length;
        j++
      ) {
        const distance =
          points[i]
            .distanceTo(
              points[j]
            );

        if (
          distance <= maxDistance
        ) {
          neighbors.push({
            j,
            distance
          });
        }
      }

      neighbors
        .sort(
          (a, b) =>
            a.distance -
            b.distance
        )
        .slice(
          0,
          maxNeighbors
        )
        .forEach(
          ({ j }) => {
            positions.push(
              points[i].x,
              points[i].y,
              points[i].z,
              points[j].x,
              points[j].y,
              points[j].z
            );

            pairs.push([
              points[i],
              points[j]
            ]);
          }
        );
    }

    const geometry =
      new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    );

    const lines =
      new THREE.LineSegments(
        geometry,
        this.lineMaterial(
          color,
          opacity
        )
      );

    this.root.add(lines);

    return pairs;
  }

  addPackets(
    pairs,
    count = 14,
    color = 0x62f1ff,
    size = 0.05
  ) {
    if (
      !pairs.length ||
      !this.prefs.DataFlow
    ) {
      return;
    }

    const n =
      Math.min(
        count,
        pairs.length
      );

    const geometry =
      new THREE.BufferGeometry();

    const positions =
      new Float32Array(
        n * 3
      );

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        positions,
        3
      )
    );

    const points =
      new THREE.Points(
        geometry,
        this.pointMaterial(
          color,
          size,
          0.95
        )
      );

    const system = {
      geometry,
      points,
      tracks:[],
      phases:[],
      speeds:[]
    };

    for (
      let i = 0;
      i < n;
      i++
    ) {
      system.tracks.push(
        pairs[
          Math.floor(
            (
              i /
              n
            ) *
            pairs.length
          )
        ]
      );

      system.phases.push(
        (
          i / n +
          Math.random() * 0.15
        ) % 1
      );

      system.speeds.push(
        0.07 +
        Math.random() * 0.13
      );
    }

    this.root.add(points);
    this.packetSystems.push(system);
  }

  buildMesh() {
    const count =
      isMobile() ? 34 : 78;

    const points =
      this.randomPoints(
        count,
        13,
        7,
        2.4
      );

    const geometry =
      new THREE.BufferGeometry()
        .setFromPoints(points);

    this.root.add(
      new THREE.Points(
        geometry,
        this.pointMaterial(
          0x20e1ed,
          0.045,
          0.78
        )
      )
    );

    const pairs =
      this.connect(
        points,
        1.75,
        2,
        0x268dce,
        0.13
      );

    this.addPackets(
      pairs,
      isMobile() ? 7 : 20
    );
  }

  fibonacciSphere(
    count,
    radius
  ) {
    const points = [];

    const goldenAngle =
      Math.PI *
      (
        3 -
        Math.sqrt(5)
      );

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const y =
        1 -
        (
          i /
          Math.max(
            1,
            count - 1
          )
        ) * 2;

      const r =
        Math.sqrt(
          Math.max(
            0,
            1 - y * y
          )
        );

      const theta =
        goldenAngle * i;

      points.push(
        new THREE.Vector3(
          Math.cos(theta) *
          r *
          radius,
          y * radius,
          Math.sin(theta) *
          r *
          radius
        )
      );
    }

    return points;
  }

  buildGlobe() {
    const points =
      this.fibonacciSphere(
        isMobile() ? 42 : 88,
        2.15
      );

    this.root.add(
      new THREE.Points(
        new THREE.BufferGeometry()
          .setFromPoints(points),
        this.pointMaterial(
          0x39e7ff,
          0.052,
          0.88
        )
      )
    );

    const pairs =
      this.connect(
        points,
        0.78,
        2,
        0x4b85ff,
        0.19
      );

    const shell =
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(
          2.18,
          2
        ),
        new THREE.MeshBasicMaterial({
          color:0x6f63ff,
          wireframe:true,
          transparent:true,
          opacity:0.055
        })
      );

    this.root.add(shell);
    this.addPackets(
      pairs,
      20,
      0xc36cff,
      0.058
    );

    this.root.position.x =
      2.4;

    this.dynamic.push(
      {
        object:this.root,
        type:'rotateY',
        speed:0.045
      }
    );
  }

  buildCyberGrid() {
    const grid =
      new THREE.GridHelper(
        16,
        32,
        0x14d9e7,
        0x17405d
      );

    grid.rotation.x =
      Math.PI / 2.35;

    grid.position.y =
      -1.6;

    grid.material.transparent =
      true;

    grid.material.opacity =
      0.22;

    this.root.add(grid);

    const points =
      this.randomPoints(
        42,
        12,
        4,
        0.5
      );

    this.root.add(
      new THREE.Points(
        new THREE.BufferGeometry()
          .setFromPoints(points),
        this.pointMaterial(
          0x57eaff,
          0.055,
          0.7
        )
      )
    );
  }

  buildDataStream() {
    const points = [];
    const tracks = [];

    for (
      let lane = 0;
      lane < 16;
      lane++
    ) {
      const x =
        -6 +
        lane * 0.8;

      const a =
        new THREE.Vector3(
          x,
          -3.7,
          -1
        );

      const b =
        new THREE.Vector3(
          x + 2.2,
          3.7,
          0.5
        );

      tracks.push([a,b]);
      points.push(a,b);
    }

    this.connect(
      points,
      0.01,
      0,
      0x1b83bb,
      0
    );

    const positions = [];

    tracks.forEach(
      ([a,b]) => {
        positions.push(
          a.x,a.y,a.z,
          b.x,b.y,b.z
        );
      }
    );

    const g =
      new THREE.BufferGeometry();

    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    );

    this.root.add(
      new THREE.LineSegments(
        g,
        this.lineMaterial(
          0x147ca9,
          0.17
        )
      )
    );

    this.addPackets(
      tracks,
      16,
      0x4ff6ff,
      0.07
    );
  }

  buildTopology(incident) {
    const levels = [
      [
        new THREE.Vector3(
          0,2.7,0
        )
      ],
      [
        new THREE.Vector3(
          -3,1,0
        ),
        new THREE.Vector3(
          0,1,0
        ),
        new THREE.Vector3(
          3,1,0
        )
      ],
      [
        new THREE.Vector3(
          -4.5,-1.5,0
        ),
        new THREE.Vector3(
          -1.5,-1.5,0
        ),
        new THREE.Vector3(
          1.5,-1.5,0
        ),
        new THREE.Vector3(
          4.5,-1.5,0
        )
      ]
    ];

    const points =
      levels.flat();

    const pairs = [];

    levels[1].forEach(
      p => pairs.push([
        levels[0][0],
        p
      ])
    );

    levels[2].forEach(
      (p,i) => {
        pairs.push([
          levels[1][
            Math.min(
              2,
              Math.floor(
                i * 0.75
              )
            )
          ],
          p
        ]);
      }
    );

    const linePositions = [];

    pairs.forEach(
      ([a,b]) =>
        linePositions.push(
          a.x,a.y,a.z,
          b.x,b.y,b.z
        )
    );

    const g =
      new THREE.BufferGeometry();

    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        linePositions,
        3
      )
    );

    this.root.add(
      new THREE.LineSegments(
        g,
        this.lineMaterial(
          incident
            ? 0xff7048
            : 0x339ee8,
          incident
            ? 0.22
            : 0.18
        )
      )
    );

    const normal =
      this.pointMaterial(
        0x35e5ef,
        0.12,
        0.92
      );

    this.root.add(
      new THREE.Points(
        new THREE.BufferGeometry()
          .setFromPoints(points),
        normal
      )
    );

    if (incident) {
      const alert =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.14,
            16,
            16
          ),
          new THREE.MeshBasicMaterial({
            color:0xff385f,
            transparent:true,
            opacity:0.85
          })
        );

      alert.position.copy(
        levels[2][2]
      );

      this.root.add(alert);

      this.dynamic.push({
        object:alert,
        type:'pulse',
        speed:2.2
      });
    }

    this.addPackets(
      pairs,
      10,
      incident
        ? 0xff9a3d
        : 0x5eefff,
      0.06
    );
  }

  buildServerMatrix(coreOnly) {
    const group =
      new THREE.Group();

    const cols =
      coreOnly ? 5 : 8;

    const rows =
      coreOnly ? 2 : 3;

    for (
      let r = 0;
      r < rows;
      r++
    ) {
      for (
        let c = 0;
        c < cols;
        c++
      ) {
        const box =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              0.62,
              1.4,
              0.55
            ),
            new THREE.MeshBasicMaterial({
              color:
                c % 3 === 0
                  ? 0x705cff
                  : 0x1ac9df,
              wireframe:true,
              transparent:true,
              opacity:0.19
            })
          );

        box.position.set(
          (c - (cols-1)/2) * 1.05,
          (r - (rows-1)/2) * 1.8,
          (Math.random()-0.5)*0.8
        );

        group.add(box);
      }
    }

    this.root.add(group);

    this.dynamic.push({
      object:group,
      type:'float',
      speed:0.3
    });
  }

  buildPopMap() {
    const points = [
      [-4,1.8],
      [-1.8,2.5],
      [0.2,1.1],
      [3.7,2],
      [-3,-1],
      [-0.6,-1.9],
      [2.1,-1.1],
      [4.5,-2]
    ].map(
      ([x,y]) =>
        new THREE.Vector3(
          x,y,0
        )
    );

    this.root.add(
      new THREE.Points(
        new THREE.BufferGeometry()
          .setFromPoints(points),
        this.pointMaterial(
          0x36e5ef,
          0.11,
          0.92
        )
      )
    );

    const pairs = [
      [points[0],points[1]],
      [points[1],points[2]],
      [points[2],points[3]],
      [points[0],points[4]],
      [points[4],points[5]],
      [points[5],points[6]],
      [points[6],points[7]],
      [points[2],points[6]]
    ];

    const pos = [];

    pairs.forEach(
      ([a,b]) =>
        pos.push(
          a.x,a.y,a.z,
          b.x,b.y,b.z
        )
    );

    const g =
      new THREE.BufferGeometry();

    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        pos,
        3
      )
    );

    this.root.add(
      new THREE.LineSegments(
        g,
        this.lineMaterial(
          0x447aff,
          0.2
        )
      )
    );

    this.addPackets(
      pairs,
      8
    );
  }

  buildFiber() {
    const curves = [];
    const allPairs = [];

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      const curve =
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(
            -6,
            -2.5 + i * 1.55,
            -0.4
          ),
          new THREE.Vector3(
            -2.5,
            -1.4 + i * 1.25,
            0.4
          ),
          new THREE.Vector3(
            1.8,
            -2.2 + i * 1.55,
            -0.2
          ),
          new THREE.Vector3(
            6,
            -1.1 + i * 1.25,
            0.2
          )
        ]);

      curves.push(curve);

      const samples =
        curve.getPoints(60);

      const g =
        new THREE.BufferGeometry()
          .setFromPoints(samples);

      this.root.add(
        new THREE.Line(
          g,
          this.lineMaterial(
            i % 2
              ? 0x735cff
              : 0x18d8e8,
            0.26
          )
        )
      );

      for (
        let j = 0;
        j < samples.length - 1;
        j += 12
      ) {
        allPairs.push([
          samples[j],
          samples[
            Math.min(
              samples.length - 1,
              j + 12
            )
          ]
        ]);
      }
    }

    this.addPackets(
      allPairs,
      14,
      0xffffff,
      0.055
    );
  }

  buildCity() {
    const group =
      new THREE.Group();

    const points = [];

    for (
      let i = 0;
      i < 28;
      i++
    ) {
      const x =
        (Math.random()-0.5)*11;

      const y =
        (Math.random()-0.5)*5.5;

      const h =
        0.18 +
        Math.random()*0.7;

      const box =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.25,
            0.25,
            h
          ),
          new THREE.MeshBasicMaterial({
            color:
              i % 4 === 0
                ? 0x7866ff
                : 0x22dce9,
            wireframe:true,
            transparent:true,
            opacity:0.25
          })
        );

      box.position.set(
        x,y,-0.3
      );

      group.add(box);

      points.push(
        new THREE.Vector3(
          x,y,0
        )
      );
    }

    this.root.add(group);

    const pairs =
      this.connect(
        points,
        2.3,
        1,
        0x2d8cc5,
        0.11
      );

    this.addPackets(
      pairs,
      10
    );
  }

  buildParticleField() {
    const points =
      this.randomPoints(
        isMobile() ? 70 : 180,
        14,
        8,
        4
      );

    const cloud =
      new THREE.Points(
        new THREE.BufferGeometry()
          .setFromPoints(points),
        this.pointMaterial(
          0x43e7ff,
          0.04,
          0.64
        )
      );

    this.root.add(cloud);

    this.dynamic.push({
      object:cloud,
      type:'rotateZ',
      speed:0.012
    });
  }

  buildHexGrid() {
    const group =
      new THREE.Group();

    const radius =
      0.46;

    for (
      let row = -4;
      row <= 4;
      row++
    ) {
      for (
        let col = -7;
        col <= 7;
        col++
      ) {
        if (
          Math.random() < 0.2
        ) {
          continue;
        }

        const geometry =
          new THREE.RingGeometry(
            radius * 0.83,
            radius,
            6
          );

        const mesh =
          new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
              color:
                (row + col) % 4 === 0
                  ? 0x735cff
                  : 0x1ecada,
              transparent:true,
              opacity:
                0.06 +
                Math.random()*0.08,
              side:THREE.DoubleSide
            })
          );

        mesh.position.set(
          col * radius * 1.7 +
          (row % 2
            ? radius * 0.85
            : 0),
          row * radius * 1.48,
          -0.6
        );

        group.add(mesh);
      }
    }

    this.root.add(group);
  }

  buildRadar() {
    const group =
      new THREE.Group();

    for (
      let i = 1;
      i <= 5;
      i++
    ) {
      const ring =
        new THREE.Mesh(
          new THREE.RingGeometry(
            i * 0.72 - 0.012,
            i * 0.72,
            96
          ),
          new THREE.MeshBasicMaterial({
            color:0x19d8e7,
            transparent:true,
            opacity:0.12,
            side:THREE.DoubleSide
          })
        );

      group.add(ring);
    }

    const sweep =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          3.6,
          0.035
        ),
        new THREE.MeshBasicMaterial({
          color:0x5ff8ff,
          transparent:true,
          opacity:0.45
        })
      );

    sweep.position.x =
      1.8;

    group.add(sweep);

    const targets = [
      [-2.1,1.1],
      [1.5,2.3],
      [2.8,-1.3],
      [-0.8,-2.4]
    ];

    targets.forEach(
      ([x,y]) => {
        const target =
          new THREE.Mesh(
            new THREE.CircleGeometry(
              0.07,
              18
            ),
            new THREE.MeshBasicMaterial({
              color:0x83fbff,
              transparent:true,
              opacity:0.9
            })
          );

        target.position.set(
          x,y,0.05
        );

        group.add(target);
      }
    );

    this.root.add(group);

    this.dynamic.push({
      object:sweep,
      type:'radar',
      speed:0.55
    });
  }

  buildOrbital() {
    const core =
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(
          0.8,
          2
        ),
        new THREE.MeshBasicMaterial({
          color:0x675cff,
          wireframe:true,
          transparent:true,
          opacity:0.28
        })
      );

    this.root.add(core);

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            1.6 + i * 0.65,
            0.012,
            4,
            128
          ),
          new THREE.MeshBasicMaterial({
            color:
              i % 2
                ? 0x735cff
                : 0x20dce9,
            transparent:true,
            opacity:0.18
          })
        );

      ring.rotation.x =
        Math.PI /
        (2.2 + i * 0.15);

      ring.rotation.y =
        i * 0.35;

      this.root.add(ring);

      this.dynamic.push({
        object:ring,
        type:
          i % 2
            ? 'rotateZNeg'
            : 'rotateZ',
        speed:
          0.06 +
          i * 0.012
      });
    }

    this.dynamic.push({
      object:core,
      type:'rotateY',
      speed:0.08
    });
  }

  updatePackets(delta) {
    const scale =
      intensityScale[
        this.prefs.AnimationIntensity
      ] || 1;

    this.packetSystems.forEach(
      system => {
        const positions =
          system.geometry
            .attributes.position.array;

        for (
          let i = 0;
          i < system.tracks.length;
          i++
        ) {
          system.phases[i] =
            (
              system.phases[i] +
              delta *
              system.speeds[i] *
              scale
            ) % 1;

          const [
            a,b
          ] =
            system.tracks[i];

          const t =
            system.phases[i];

          const idx =
            i * 3;

          positions[idx] =
            THREE.MathUtils.lerp(
              a.x,b.x,t
            );

          positions[idx+1] =
            THREE.MathUtils.lerp(
              a.y,b.y,t
            );

          positions[idx+2] =
            THREE.MathUtils.lerp(
              a.z,b.z,t
            );
        }

        system.geometry
          .attributes.position
          .needsUpdate = true;
      }
    );
  }

  updateDynamic(delta, elapsed) {
    const scale =
      intensityScale[
        this.prefs.AnimationIntensity
      ] || 1;

    this.dynamic.forEach(
      item => {
        const speed =
          item.speed * scale;

        if (
          item.type === 'rotateY'
        ) {
          item.object.rotation.y +=
            delta * speed;
        }

        if (
          item.type === 'rotateZ'
        ) {
          item.object.rotation.z +=
            delta * speed;
        }

        if (
          item.type === 'rotateZNeg'
        ) {
          item.object.rotation.z -=
            delta * speed;
        }

        if (
          item.type === 'float'
        ) {
          item.object.position.y =
            Math.sin(
              elapsed * speed
            ) * 0.12;
        }

        if (
          item.type === 'pulse'
        ) {
          const s =
            1 +
            Math.sin(
              elapsed * speed
            ) * 0.35;

          item.object.scale.setScalar(s);
        }

        if (
          item.type === 'radar'
        ) {
          item.object.rotation.z =
            -elapsed * speed;
        }
      }
    );
  }

  resize() {
    if (
      !this.renderer ||
      !this.camera
    ) {
      return;
    }

    const width =
      Math.max(
        1,
        this.container.clientWidth
      );

    const height =
      Math.max(
        1,
        this.container.clientHeight
      );

    this.camera.aspect =
      width / height;

    this.camera
      .updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height,
      false
    );
  }

  animate = () => {
    requestAnimationFrame(
      this.animate
    );

    if (
      !this.renderer ||
      document.hidden ||
      this.prefs.BackgroundScene ===
        'off'
    ) {
      this.clock.getDelta();
      return;
    }

    if (
      isMobile() &&
      this.prefs.ReduceMotionMobile
    ) {
      this.clock.getDelta();

      this.renderer.render(
        this.scene,
        this.camera
      );

      return;
    }

    const delta =
      Math.min(
        this.clock.getDelta(),
        0.04
      );

    const elapsed =
      this.clock.elapsedTime;

    if (
      !prefersReducedMotion.matches
    ) {
      this.updatePackets(delta);
      this.updateDynamic(
        delta,
        elapsed
      );

      if (
        this.prefs.MouseParallax
      ) {
        this.root.rotation.y =
          THREE.MathUtils.lerp(
            this.root.rotation.y,
            this.pointer.x * 0.025,
            0.02
          );

        this.root.rotation.x =
          THREE.MathUtils.lerp(
            this.root.rotation.x,
            this.pointer.y * 0.018,
            0.02
          );
      }
    }

    this.renderer.render(
      this.scene,
      this.camera
    );
  };
}


class LoginScene {
  constructor(container) {
    this.container = container;

    if (
      !container ||
      !supportsWebGL()
    ) {
      return;
    }

    this.scene =
      new THREE.Scene();

    this.camera =
      new THREE.PerspectiveCamera(
        42,1,0.1,100
      );

    this.camera.position.z =
      7.4;

    this.renderer =
      new THREE.WebGLRenderer({
        alpha:true,
        antialias:!isMobile()
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        1.5
      )
    );

    this.renderer.setSize(
      container.clientWidth || 1,
      container.clientHeight || 1,
      false
    );

    this.renderer.domElement.className =
      'three-core-canvas';

    container.appendChild(
      this.renderer.domElement
    );

    this.root =
      new THREE.Group();

    this.scene.add(this.root);

    const points = [];

    const golden =
      Math.PI *
      (
        3 -
        Math.sqrt(5)
      );

    for (
      let i = 0;
      i < 82;
      i++
    ) {
      const y =
        1 -
        (
          i / 81
        ) * 2;

      const r =
        Math.sqrt(
          Math.max(
            0,
            1 - y*y
          )
        );

      const theta =
        golden * i;

      points.push(
        new THREE.Vector3(
          Math.cos(theta)*r*2.1,
          y*2.1,
          Math.sin(theta)*r*2.1
        )
      );
    }

    this.root.add(
      new THREE.Points(
        new THREE.BufferGeometry()
          .setFromPoints(points),
        new THREE.PointsMaterial({
          color:0x32e7f5,
          size:0.052,
          transparent:true,
          opacity:0.86,
          blending:
            THREE.AdditiveBlending,
          depthWrite:false
        })
      )
    );

    this.root.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(
          2.14,
          2
        ),
        new THREE.MeshBasicMaterial({
          color:0x6e63ff,
          wireframe:true,
          transparent:true,
          opacity:0.06
        })
      )
    );

    this.root.position.x =
      0.9;

    this.clock =
      new THREE.Clock();

    new ResizeObserver(
      () => this.resize()
    ).observe(container);

    this.animate();
  }

  resize() {
    if (
      !this.renderer
    ) {
      return;
    }

    const w =
      this.container.clientWidth || 1;

    const h =
      this.container.clientHeight || 1;

    this.camera.aspect =
      w / h;

    this.camera
      .updateProjectionMatrix();

    this.renderer.setSize(
      w,h,false
    );
  }

  animate = () => {
    requestAnimationFrame(
      this.animate
    );

    if (
      !this.renderer ||
      document.hidden
    ) {
      return;
    }

    const delta =
      Math.min(
        this.clock.getDelta(),
        0.04
      );

    if (
      !prefersReducedMotion.matches
    ) {
      this.root.rotation.y +=
        delta * 0.07;
    }

    this.renderer.render(
      this.scene,
      this.camera
    );
  };
}


function initThreeCore() {
  const loginContainer =
    document.getElementById(
      'threeLoginCore'
    );

  const appContainer =
    document.getElementById(
      'threeAppCore'
    );

  const login =
    loginContainer
      ? new LoginScene(
          loginContainer
        )
      : null;

  const app =
    appContainer
      ? new AppSceneEngine(
          appContainer
        )
      : null;

  const initial =
    normalizePrefs(
      window.MLNAppearancePreferences
    );

  app?.setPreferences(initial);

  window.addEventListener(
    'mln:appearance-change',
    event => {
      app?.setPreferences(
        event.detail?.preferences
      );
    }
  );

  window.addEventListener(
    'mln:appearance-reset',
    () => {
      app?.setPreferences(
        DEFAULTS
      );
    }
  );

  window.addEventListener(
    'mln:page-change',
    event => {
      app?.setPage(
        event.detail?.page
      );
    }
  );

  window.MLNThreeCore = {
    login,
    app,
    setPreferences:
      prefs =>
        app?.setPreferences(prefs),
    setScene:
      scene =>
        app?.setPreferences(
          Object.assign(
            {},
            app.prefs,
            {
              BackgroundScene:
                scene
            }
          )
        ),
    version:
      'V10-SceneSettings'
  };
}


if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    initThreeCore,
    {
      once:true
    }
  );
} else {
  initThreeCore();
}
