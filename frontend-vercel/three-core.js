import * as THREE from 'three';

const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
);

const isSmallScreen = () =>
  window.matchMedia('(max-width: 767px)').matches;

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl')
    );
  } catch (_) {
    return false;
  }
}

class CoreScene {
  constructor(container, mode = 'app') {
    this.container = container;
    this.mode = mode;
    this.running = false;
    this.destroyed = false;
    this.activity = 1;
    this.pointer = { x: 0, y: 0 };
    this.clock = new THREE.Clock();
    this.packetTracks = [];
    this.packetPhases = [];
    this.packetSpeeds = [];

    this.init();
  }

  init() {
    if (!this.container || !supportsWebGL()) {
      this.container?.classList.add('three-core-fallback');
      return;
    }

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      this.mode === 'login' ? 42 : 48,
      1,
      0.1,
      100
    );

    this.camera.position.set(
      0,
      0,
      this.mode === 'login' ? 7.4 : 9.2
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSmallScreen(),
      alpha: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        isSmallScreen() ? 1 : 1.5
      )
    );

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    this.renderer.domElement.className =
      'three-core-canvas';

    this.container.appendChild(
      this.renderer.domElement
    );

    this.root = new THREE.Group();
    this.scene.add(this.root);

    if (this.mode === 'login') {
      this.buildLoginCore();
    } else {
      this.buildAppCore();
    }

    this.resizeObserver =
      new ResizeObserver(() => this.resize());

    this.resizeObserver.observe(this.container);

    this.onPointerMove =
      event => {
        const rect =
          this.container.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        this.pointer.x =
          ((event.clientX - rect.left) / rect.width) * 2 - 1;

        this.pointer.y =
          -(
            ((event.clientY - rect.top) / rect.height) * 2 - 1
          );
      };

    window.addEventListener(
      'pointermove',
      this.onPointerMove,
      { passive: true }
    );

    this.resize();
    this.running = true;
    this.animate();
  }

  makeGlowPointMaterial(
    color,
    size,
    opacity = 1
  ) {
    return new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  fibonacciSphere(count, radius) {
    const points = [];
    const goldenAngle =
      Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const y =
        1 - (i / Math.max(1, count - 1)) * 2;

      const ringRadius =
        Math.sqrt(
          Math.max(0, 1 - y * y)
        );

      const theta =
        goldenAngle * i;

      points.push(
        new THREE.Vector3(
          Math.cos(theta) * ringRadius * radius,
          y * radius,
          Math.sin(theta) * ringRadius * radius
        )
      );
    }

    return points;
  }

  buildConnections(points, maxDistance, maxNeighbors = 3) {
    const pairs = [];
    const linePositions = [];

    for (let i = 0; i < points.length; i++) {
      const distances = [];

      for (let j = i + 1; j < points.length; j++) {
        const distance =
          points[i].distanceTo(points[j]);

        if (distance <= maxDistance) {
          distances.push({
            j,
            distance
          });
        }
      }

      distances
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxNeighbors)
        .forEach(({ j }) => {
          pairs.push([points[i], points[j]]);

          linePositions.push(
            points[i].x,
            points[i].y,
            points[i].z,
            points[j].x,
            points[j].y,
            points[j].z
          );
        });
    }

    return {
      pairs,
      linePositions
    };
  }

  buildPacketCloud(
    pairs,
    count,
    color,
    size
  ) {
    if (!pairs.length) return;

    const packetCount =
      Math.min(count, pairs.length);

    const positions =
      new Float32Array(packetCount * 3);

    this.packetTracks = [];

    for (let i = 0; i < packetCount; i++) {
      const pair =
        pairs[
          Math.floor(
            (i / packetCount) * pairs.length
          )
        ];

      this.packetTracks.push(pair);
      this.packetPhases.push(
        (i / packetCount + Math.random() * 0.15) % 1
      );

      this.packetSpeeds.push(
        0.08 + Math.random() * 0.13
      );
    }

    this.packetGeometry =
      new THREE.BufferGeometry();

    this.packetGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        positions,
        3
      )
    );

    this.packetMaterial =
      this.makeGlowPointMaterial(
        color,
        size,
        0.95
      );

    this.packetPoints =
      new THREE.Points(
        this.packetGeometry,
        this.packetMaterial
      );

    this.root.add(
      this.packetPoints
    );
  }

  buildLoginCore() {
    const mobile =
      isSmallScreen();

    const nodeCount =
      mobile ? 42 : 86;

    const radius =
      mobile ? 1.75 : 2.15;

    const points =
      this.fibonacciSphere(
        nodeCount,
        radius
      );

    const nodeGeometry =
      new THREE.BufferGeometry()
        .setFromPoints(points);

    const nodeMaterial =
      this.makeGlowPointMaterial(
        0x38e8ff,
        mobile ? 0.045 : 0.052,
        0.9
      );

    this.nodePoints =
      new THREE.Points(
        nodeGeometry,
        nodeMaterial
      );

    this.root.add(
      this.nodePoints
    );

    const {
      pairs,
      linePositions
    } =
      this.buildConnections(
        points,
        mobile ? 0.92 : 0.78,
        2
      );

    const lineGeometry =
      new THREE.BufferGeometry();

    lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        linePositions,
        3
      )
    );

    const lineMaterial =
      new THREE.LineBasicMaterial({
        color: 0x3e8fff,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

    this.networkLines =
      new THREE.LineSegments(
        lineGeometry,
        lineMaterial
      );

    this.root.add(
      this.networkLines
    );

    const shellGeometry =
      new THREE.IcosahedronGeometry(
        radius * 1.02,
        2
      );

    const shellMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x6c63ff,
        wireframe: true,
        transparent: true,
        opacity: 0.055,
        depthWrite: false
      });

    this.shell =
      new THREE.Mesh(
        shellGeometry,
        shellMaterial
      );

    this.root.add(
      this.shell
    );

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x2ee7ff,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

    this.ringA =
      new THREE.Mesh(
        new THREE.TorusGeometry(
          radius * 1.28,
          0.008,
          5,
          128
        ),
        ringMaterial
      );

    this.ringA.rotation.x =
      Math.PI / 2.7;

    this.ringA.rotation.y =
      Math.PI / 4.5;

    this.root.add(
      this.ringA
    );

    this.ringB =
      this.ringA.clone();

    this.ringB.rotation.x =
      Math.PI / 1.8;

    this.ringB.rotation.y =
      -Math.PI / 5;

    this.root.add(
      this.ringB
    );

    this.root.position.set(
      mobile ? 0.25 : 0.85,
      mobile ? -0.4 : -0.45,
      0
    );

    this.buildPacketCloud(
      pairs,
      mobile ? 8 : 20,
      0xb15cff,
      mobile ? 0.052 : 0.06
    );

    const starCount =
      mobile ? 34 : 80;

    const starPositions =
      new Float32Array(
        starCount * 3
      );

    for (let i = 0; i < starCount; i++) {
      const spread = 6;

      starPositions[i * 3] =
        (Math.random() - 0.5) *
        spread;

      starPositions[i * 3 + 1] =
        (Math.random() - 0.5) *
        spread;

      starPositions[i * 3 + 2] =
        -2 - Math.random() * 4;
    }

    const starGeometry =
      new THREE.BufferGeometry();

    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        starPositions,
        3
      )
    );

    this.stars =
      new THREE.Points(
        starGeometry,
        this.makeGlowPointMaterial(
          0x507cff,
          mobile ? 0.025 : 0.032,
          0.45
        )
      );

    this.scene.add(
      this.stars
    );
  }

  buildAppCore() {
    const mobile =
      isSmallScreen();

    const nodeCount =
      mobile ? 34 : 72;

    const points = [];

    for (let i = 0; i < nodeCount; i++) {
      points.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 13,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 2.2
        )
      );
    }

    const nodeGeometry =
      new THREE.BufferGeometry()
        .setFromPoints(points);

    const colors =
      new Float32Array(
        nodeCount * 3
      );

    const cyan =
      new THREE.Color(0x16e0ee);

    const violet =
      new THREE.Color(0x7568ff);

    for (let i = 0; i < nodeCount; i++) {
      const c =
        Math.random() > 0.72
          ? violet
          : cyan;

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    nodeGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(
        colors,
        3
      )
    );

    const nodeMaterial =
      new THREE.PointsMaterial({
        size: mobile ? 0.032 : 0.045,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

    this.nodePoints =
      new THREE.Points(
        nodeGeometry,
        nodeMaterial
      );

    this.root.add(
      this.nodePoints
    );

    const {
      pairs,
      linePositions
    } =
      this.buildConnections(
        points,
        mobile ? 2.15 : 1.75,
        2
      );

    const lineGeometry =
      new THREE.BufferGeometry();

    lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        linePositions,
        3
      )
    );

    this.networkLines =
      new THREE.LineSegments(
        lineGeometry,
        new THREE.LineBasicMaterial({
          color: 0x268dce,
          transparent: true,
          opacity: 0.11,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

    this.root.add(
      this.networkLines
    );

    this.buildPacketCloud(
      pairs,
      mobile ? 7 : 18,
      0x62f1ff,
      mobile ? 0.045 : 0.055
    );

    const ringGroup =
      new THREE.Group();

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x6f63ff,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

    for (let i = 0; i < 3; i++) {
      const ring =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            1.5 + i * 0.7,
            0.006,
            4,
            96
          ),
          ringMaterial
        );

      ring.rotation.x =
        Math.PI / 2.1;

      ring.rotation.z =
        i * 0.33;

      ringGroup.add(ring);
    }

    ringGroup.position.set(
      3.7,
      2.2,
      -1.2
    );

    this.ringGroup =
      ringGroup;

    this.root.add(
      ringGroup
    );

    this.root.rotation.x =
      -0.08;
  }

  setActivity(value) {
    this.activity =
      clamp(
        Number(value) || 1,
        0.55,
        2.2
      );
  }

  resize() {
    if (
      !this.renderer ||
      !this.camera ||
      !this.container
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

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height,
      false
    );
  }

  updatePackets(delta) {
    if (
      !this.packetGeometry ||
      !this.packetTracks.length
    ) {
      return;
    }

    const positions =
      this.packetGeometry
        .attributes.position.array;

    for (
      let i = 0;
      i < this.packetTracks.length;
      i++
    ) {
      this.packetPhases[i] =
        (
          this.packetPhases[i] +
          delta *
          this.packetSpeeds[i] *
          this.activity
        ) % 1;

      const [
        start,
        end
      ] =
        this.packetTracks[i];

      const t =
        this.packetPhases[i];

      const index =
        i * 3;

      positions[index] =
        THREE.MathUtils.lerp(
          start.x,
          end.x,
          t
        );

      positions[index + 1] =
        THREE.MathUtils.lerp(
          start.y,
          end.y,
          t
        );

      positions[index + 2] =
        THREE.MathUtils.lerp(
          start.z,
          end.z,
          t
        );
    }

    this.packetGeometry
      .attributes.position
      .needsUpdate = true;
  }

  shouldRender() {
    if (
      this.destroyed ||
      !this.container ||
      document.hidden
    ) {
      return false;
    }

    const parentSection =
      this.mode === 'login'
        ? document.getElementById('loginPage')
        : document.getElementById('appPage');

    return !!(
      parentSection &&
      !parentSection.classList.contains('hidden')
    );
  }

  animate = () => {
    if (this.destroyed) return;

    requestAnimationFrame(
      this.animate
    );

    if (
      !this.running ||
      !this.renderer ||
      !this.shouldRender()
    ) {
      this.clock.getDelta();
      return;
    }

    const delta =
      Math.min(
        this.clock.getDelta(),
        0.04
      );

    const elapsed =
      this.clock.elapsedTime;

    const reduced =
      prefersReducedMotion.matches;

    if (!reduced) {
      this.updatePackets(delta);

      if (this.mode === 'login') {
        this.root.rotation.y +=
          delta * 0.08 * this.activity;

        this.root.rotation.x =
          THREE.MathUtils.lerp(
            this.root.rotation.x,
            this.pointer.y * 0.10,
            0.025
          );

        this.root.rotation.z =
          THREE.MathUtils.lerp(
            this.root.rotation.z,
            -this.pointer.x * 0.07,
            0.025
          );

        if (this.ringA) {
          this.ringA.rotation.z +=
            delta * 0.07;
        }

        if (this.ringB) {
          this.ringB.rotation.z -=
            delta * 0.05;
        }

        if (this.stars) {
          this.stars.rotation.z +=
            delta * 0.005;
        }
      } else {
        this.root.rotation.y =
          THREE.MathUtils.lerp(
            this.root.rotation.y,
            this.pointer.x * 0.025,
            0.02
          );

        this.root.rotation.x =
          THREE.MathUtils.lerp(
            this.root.rotation.x,
            -0.08 +
            this.pointer.y * 0.018,
            0.02
          );

        this.root.position.x =
          THREE.MathUtils.lerp(
            this.root.position.x,
            this.pointer.x * 0.16,
            0.02
          );

        this.root.position.y =
          THREE.MathUtils.lerp(
            this.root.position.y,
            this.pointer.y * 0.10,
            0.02
          );

        if (this.ringGroup) {
          this.ringGroup.rotation.z =
            elapsed * 0.025;
        }
      }
    }

    this.renderer.render(
      this.scene,
      this.camera
    );
  };

  destroy() {
    this.destroyed = true;
    this.running = false;

    this.resizeObserver?.disconnect();

    window.removeEventListener(
      'pointermove',
      this.onPointerMove
    );

    this.renderer?.dispose();

    this.container?.replaceChildren();
  }
}

function initCoreNetwork3D() {
  const loginContainer =
    document.getElementById(
      'threeLoginCore'
    );

  const appContainer =
    document.getElementById(
      'threeAppCore'
    );

  if (
    !loginContainer &&
    !appContainer
  ) {
    return;
  }

  const loginScene =
    loginContainer
      ? new CoreScene(
          loginContainer,
          'login'
        )
      : null;

  const appScene =
    appContainer
      ? new CoreScene(
          appContainer,
          'app'
        )
      : null;

  const applyPageMode =
    page => {
      const normalized =
        String(page || '')
          .toLowerCase();

      const dashboard =
        normalized === 'dashboard';

      appContainer?.classList.toggle(
        'is-dashboard',
        dashboard
      );

      appContainer?.classList.toggle(
        'is-secondary-page',
        !dashboard
      );

      appScene?.setActivity(
        dashboard ? 1.25 : 0.62
      );
    };

  window.addEventListener(
    'mln:page-change',
    event => {
      applyPageMode(
        event.detail?.page
      );
    }
  );

  window.addEventListener(
    'mln:dashboard-metrics',
    event => {
      const metrics =
        event.detail || {};

      const total =
        Number(
          metrics.totalDevices || 0
        );

      const pending =
        Number(
          metrics.pendingPermits || 0
        );

      const flow =
        Number(
          metrics.deviceInThisMonth || 0
        ) +
        Number(
          metrics.deviceOutThisMonth || 0
        );

      const activity =
        0.9 +
        Math.min(total, 120) / 180 +
        Math.min(pending, 8) * 0.05 +
        Math.min(flow, 20) * 0.015;

      appScene?.setActivity(
        activity
      );
    }
  );

  const title =
    document.getElementById(
      'topTitle'
    );

  if (title) {
    const observer =
      new MutationObserver(() => {
        const text =
          title.textContent || '';

        applyPageMode(
          /overview|dashboard/i.test(text)
            ? 'dashboard'
            : 'secondary'
        );
      });

    observer.observe(
      title,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    applyPageMode(
      /overview|dashboard/i.test(
        title.textContent || ''
      )
        ? 'dashboard'
        : 'secondary'
    );
  }

  window.MLNThreeCore = {
    loginScene,
    appScene,
    version: 'V9-r187'
  };
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initCoreNetwork3D,
    { once: true }
  );
} else {
  initCoreNetwork3D();
}
