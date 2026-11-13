// three-scene.js - 3D PlayStation Symbols Hero Scene

console.log("[three-scene.js] Initializing...");

const initThreeScene = () => {
    try {
        const canvas = document.querySelector('#three-canvas');
        if (!canvas) {
            console.error("[three-scene.js] Canvas not found!");
            return;
        }

        const scene = new THREE.Scene();
        
        // Camera
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 12;

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;

        // --- Environment & Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(-5, 5, 5);
        scene.add(keyLight);

        const rimLight = new THREE.PointLight(0x0070D1, 3.0);
        rimLight.position.set(5, -2, -3);
        scene.add(rimLight);

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture; 

        // Main Group
        const symbolsGroup = new THREE.Group();
        scene.add(symbolsGroup);

        const symbols = [];
        
        // Materials
        const symbolMat = new THREE.MeshPhysicalMaterial({
            color: 0x0070D1,
            emissive: 0x2E6DB4,
            emissiveIntensity: 0.1,
            roughness: 0.1,
            metalness: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transmission: 0.2, // Subtle glass-like quality
            thickness: 0.5
        });

        // --- Geometries ---
        const extrudeSettings = { depth: 0.3, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 };

        // 1. Triangle
        const triShape = new THREE.Shape();
        triShape.moveTo(0, 0.8);
        triShape.lineTo(0.7, -0.4);
        triShape.lineTo(-0.7, -0.4);
        triShape.lineTo(0, 0.8);
        
        // Hollow triangle using holes
        const triHole = new THREE.Path();
        triHole.moveTo(0, 0.4);
        triHole.lineTo(-0.4, -0.2);
        triHole.lineTo(0.4, -0.2);
        triHole.lineTo(0, 0.4);
        triShape.holes.push(triHole);

        const triGeo = new THREE.ExtrudeGeometry(triShape, extrudeSettings);
        triGeo.translate(0, 0, -0.15); // Center Z

        // 2. Circle (Torus)
        const circGeo = new THREE.TorusGeometry(0.6, 0.15, 16, 64);

        // 3. Cross
        const crossShape = new THREE.Shape();
        const cw = 0.2, cl = 0.6;
        crossShape.moveTo(-cw, cl);
        crossShape.lineTo(cw, cl);
        crossShape.lineTo(cw, cw);
        crossShape.lineTo(cl, cw);
        crossShape.lineTo(cl, -cw);
        crossShape.lineTo(cw, -cw);
        crossShape.lineTo(cw, -cl);
        crossShape.lineTo(-cw, -cl);
        crossShape.lineTo(-cw, -cw);
        crossShape.lineTo(-cl, -cw);
        crossShape.lineTo(-cl, cw);
        crossShape.lineTo(-cw, cw);
        crossShape.lineTo(-cw, cl);
        
        // Slightly rotate cross to look like X
        const crossGeo = new THREE.ExtrudeGeometry(crossShape, extrudeSettings);
        crossGeo.translate(0, 0, -0.15);
        crossGeo.rotateZ(Math.PI / 4);

        // 4. Square
        const sqShape = new THREE.Shape();
        const s = 0.6, r = 0.1;
        sqShape.moveTo(-s, s-r);
        sqShape.quadraticCurveTo(-s, s, -s+r, s);
        sqShape.lineTo(s-r, s);
        sqShape.quadraticCurveTo(s, s, s, s-r);
        sqShape.lineTo(s, -s+r);
        sqShape.quadraticCurveTo(s, -s, s-r, -s);
        sqShape.lineTo(-s+r, -s);
        sqShape.quadraticCurveTo(-s, -s, -s, -s+r);
        sqShape.lineTo(-s, s-r);
        
        const sqHole = new THREE.Path();
        const sh = 0.35, rh = 0.05;
        sqHole.moveTo(-sh, sh-rh);
        sqHole.lineTo(-sh, -sh+rh);
        sqHole.quadraticCurveTo(-sh, -sh, -sh+rh, -sh);
        sqHole.lineTo(sh-rh, -sh);
        sqHole.quadraticCurveTo(sh, -sh, sh, -sh+rh);
        sqHole.lineTo(sh, sh-rh);
        sqHole.quadraticCurveTo(sh, sh, sh-rh, sh);
        sqHole.lineTo(-sh+rh, sh);
        sqHole.quadraticCurveTo(-sh, sh, -sh, sh-rh);
        sqShape.holes.push(sqHole);

        const sqGeo = new THREE.ExtrudeGeometry(sqShape, extrudeSettings);
        sqGeo.translate(0, 0, -0.15);

        // Assemble Symbols
        const addSymbol = (geo, x, y, z, rotSpeedX, rotSpeedY, floatPhase) => {
            const mesh = new THREE.Mesh(geo, symbolMat.clone());
            mesh.position.set(x, y, z);
            
            // Random initial rotation
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            
            mesh.userData = {
                baseX: x, baseY: y, baseZ: z,
                rotX: rotSpeedX, rotY: rotSpeedY,
                phase: floatPhase,
                targetScale: 1
            };
            symbolsGroup.add(mesh);
            symbols.push(mesh);
        };

        // Diamond formation
        addSymbol(triGeo, 0, 2.5, 0, 0.01, 0.02, 0);
        addSymbol(circGeo, 2.5, 0, 1, 0.02, 0.01, Math.PI / 2);
        addSymbol(crossGeo, 0, -2.5, 0, -0.015, -0.02, Math.PI);
        addSymbol(sqGeo, -2.5, 0, -1, 0.02, -0.015, Math.PI * 1.5);

        // Initial Pose
        const isMobile = window.innerWidth <= 1024;
        symbolsGroup.position.x = isMobile ? 0 : 3.5; 
        symbolsGroup.position.y = isMobile ? -1 : 0;
        const scale = isMobile ? 0.6 : 1;
        symbolsGroup.scale.set(scale, scale, scale);
        
        let baseRotationX = 0;
        let baseRotationY = 0;

        // --- Particles ---
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 80;
        const posArray = new Float32Array(particlesCount * 3);
        
        for(let i=0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 20;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.08,
            color: 0x4A90D9,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);

        // --- Interaction Logic ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let inertiaX = 0;
        let inertiaY = 0;
        
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;

        const onPointerMove = (e) => {
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            if (clientX === undefined) return;
            
            mouseX = (clientX - windowHalfX) / windowHalfX;
            mouseY = (clientY - windowHalfY) / windowHalfY;

            if (isDragging) {
                const deltaX = clientX - dragStartX;
                const deltaY = clientY - dragStartY;
                inertiaY = deltaX * 0.005;
                inertiaX = deltaY * 0.005;
                baseRotationY += inertiaY;
                baseRotationX += inertiaX;
                dragStartX = clientX;
                dragStartY = clientY;
            }

            // Raycast for hover
            mouse.x = (clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            
            const intersects = raycaster.intersectObjects(symbols);
            
            symbols.forEach(sym => {
                sym.userData.targetScale = 1;
                gsap.to(sym.material, { emissiveIntensity: 0.1, duration: 0.3 });
            });
            
            if (intersects.length > 0) {
                const obj = intersects[0].object;
                obj.userData.targetScale = 1.2;
                gsap.to(obj.material, { emissiveIntensity: 1.0, duration: 0.3 });
                document.body.style.cursor = 'pointer';
            } else {
                document.body.style.cursor = 'auto';
            }
        };

        const onPointerDown = (e) => {
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            if (clientX === undefined) return;

            isDragging = true;
            dragStartX = clientX;
            dragStartY = clientY;
            
            // Check Click
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(symbols);
            if(intersects.length > 0) {
                const obj = intersects[0].object;
                // Spin 360
                gsap.to(obj.rotation, {
                    x: obj.rotation.x + Math.PI * 2,
                    y: obj.rotation.y + Math.PI * 2,
                    duration: 1,
                    ease: "power2.out"
                });
                // Glow Burst
                gsap.to(obj.material, { emissiveIntensity: 3.0, duration: 0.2, yoyo: true, repeat: 1 });
            }
        };

        const onPointerUp = () => {
            isDragging = false;
        };

        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mouseup', onPointerUp);
        window.addEventListener('mouseleave', onPointerUp);
        
        window.addEventListener('touchstart', onPointerDown, {passive: false});
        window.addEventListener('touchmove', onPointerMove, {passive: false});
        window.addEventListener('touchend', onPointerUp);

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));
            
            const mobile = window.innerWidth <= 1024;
            const extraSmall = window.innerWidth <= 480;
            gsap.to(symbolsGroup.position, {
                x: mobile ? 0 : 3.5,
                y: mobile ? -1 : 0,
                duration: 0.5
            });
            const s = mobile ? (extraSmall ? 0.45 : 0.6) : 1;
            gsap.to(symbolsGroup.scale, { x: s, y: s, z: s, duration: 0.5 });
        });

        // Visibility observer
        let isVisible = true;
        const observer = new IntersectionObserver((entries) => {
            isVisible = entries[0].isIntersecting;
        });
        observer.observe(canvas);

        // --- Animation Loop ---
        const clock = new THREE.Clock();
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const animate = () => {
            requestAnimationFrame(animate);
            if (!isVisible || document.hidden) return; // Pause rendering if not visible or tab hidden

            const elapsedTime = clock.getElapsedTime();

            if (!prefersReducedMotion) {
                // Symbols floating and rotating
                symbols.forEach(sym => {
                    sym.rotation.x += sym.userData.rotX;
                    sym.rotation.y += sym.userData.rotY;
                    
                    // Float
                    sym.position.y = sym.userData.baseY + Math.sin(elapsedTime * 2 + sym.userData.phase) * 0.3;
                    
                    // Scale Lerp (Hover)
                    sym.scale.lerp(new THREE.Vector3(sym.userData.targetScale, sym.userData.targetScale, sym.userData.targetScale), 0.1);
                });

                // Group Parallax / Inertia
                targetX = mouseX * 0.5;
                targetY = mouseY * 0.5;
                
                if(!isDragging) {
                    // Inertia decay
                    inertiaX *= 0.95;
                    inertiaY *= 0.95;
                    baseRotationX += inertiaX;
                    baseRotationY += inertiaY;
                    
                    // Return to center slowly
                    baseRotationX += (0 - baseRotationX) * 0.02;
                    baseRotationY += (0 - baseRotationY) * 0.02;
                }

                // Apply Parallax and Rotation
                symbolsGroup.rotation.y += 0.1 * (baseRotationY + targetX - symbolsGroup.rotation.y);
                symbolsGroup.rotation.x += 0.1 * (baseRotationX + targetY - symbolsGroup.rotation.x);

                // Rotate particles slowly
                particlesMesh.rotation.y = elapsedTime * 0.02;
            }

            renderer.render(scene, camera);
        };

        animate();
        console.log("[three-scene.js] Animation loop started.");

    } catch (e) {
        console.error("[three-scene.js] FATAL ERROR IN INIT:", e);
        const fallback = document.getElementById('hero-fallback');
        if(fallback) {
            fallback.classList.remove('sr-only');
            fallback.style.display = 'block';
        }
    }
};

window.addEventListener('load', () => {
    // Failsafe timeout just to ensure preloader drops quickly even if load fails
    setTimeout(initThreeScene, 100);
});
