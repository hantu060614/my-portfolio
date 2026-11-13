// lanyard.js - Interactive 3D Lanyard & ID Card

const DEBUG = false; // Set to true to see anchor calculation logs

if (DEBUG) console.log("[lanyard.js] Initializing...");

// Ensure manual scroll restoration to prevent layout jumps on refresh
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

const initLanyard = () => {
    try {
        const container = document.getElementById('lanyard-container');
        const canvas = document.getElementById('lanyard-canvas');
        const underline = document.getElementById('about-underline');
        const aboutMeSpan = document.getElementById('aboutMe');
        
        if (!container || !canvas || !aboutMeSpan) {
            console.error("[lanyard.js] Container, canvas, or anchor elements not found.");
            return;
        }

        // --- Configuration ---
        const CONFIG = {
            ROPE_LENGTH: 1.5,
            ROPE_SEGMENTS: 10,
            DAMPING_LINEAR: 0.98, 
            DAMPING_ANGULAR: 0.97,
            DRAG_STIFFNESS: 0.5,
            CONSTRAINT_ITERATIONS: 20,
            MAX_SWING_ANGLE: Math.PI / 1.5, 
            BOUNDS_PADDING: 1.0, 
            CARD_WIDTH: 1.8,
            CARD_HEIGHT: 2.52,
            CARD_DEPTH: 0.02,
            CORNER_RADIUS: 0.08
        };

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.z = 8.5; 
        camera.position.y = -1.0; 

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(2, 5, 4);
        scene.add(dirLight);

        const pointLight = new THREE.PointLight(0x0070D1, 1.0);
        pointLight.position.set(-2, -1, 2);
        scene.add(pointLight);

        // --- Anchor Calculation ---
        let anchorPos = new THREE.Vector3(0, 3.5, 0);
        let columnBoundsX = 5.0; // Dynamic right bound
        let isReady = false;

        const updateAnchorPosition = (triggerSource = "unknown") => {
            if (!aboutMeSpan || !canvas) return;
            
            const spanRect = aboutMeSpan.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            
            if (canvasRect.width === 0 || canvasRect.height === 0) return; // Not ready

            // Relative position calculation (immune to scroll/transforms on parent)
            const relX = (spanRect.left + spanRect.width / 2) - canvasRect.left;
            const relY = spanRect.bottom - canvasRect.top;
            
            const ndcX = (relX / canvasRect.width) * 2 - 1;
            const ndcY = -(relY / canvasRect.height) * 2 + 1;
            
            const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
            vector.unproject(camera);
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z;
            const pos = camera.position.clone().add(dir.multiplyScalar(distance));
            
            if (!isNaN(pos.x) && !isNaN(pos.y)) {
                anchorPos.copy(pos);
                anchorPos.z = 0; 
                isReady = true;
            }
            
            // Calculate physical right bound (half of the container on desktop, full width on mobile/tablet)
            const isMobileScreen = window.innerWidth <= 1024;
            const rightEdgeClientX = isMobileScreen ? canvasRect.width - 24 : canvasRect.width / 2 - 40; 
            const boundNdcX = (rightEdgeClientX / canvasRect.width) * 2 - 1;
            const boundVec = new THREE.Vector3(boundNdcX, 0, 0.5).unproject(camera);
            const boundDir = boundVec.sub(camera.position).normalize();
            columnBoundsX = camera.position.clone().add(boundDir.multiplyScalar(distance)).x;

            if (DEBUG) {
                console.log(`[lanyard.js] Anchor updated by: ${triggerSource}`);
                console.log(`  - Rect ME: left=${spanRect.left}, bottom=${spanRect.bottom}, w=${spanRect.width}`);
                console.log(`  - Rect Canvas: left=${canvasRect.left}, top=${canvasRect.top}, w=${canvasRect.width}, h=${canvasRect.height}`);
                console.log(`  - NDC: x=${ndcX.toFixed(3)}, y=${ndcY.toFixed(3)}`);
                console.log(`  - World Pos: x=${anchorPos.x.toFixed(3)}, y=${anchorPos.y.toFixed(3)}`);
                console.log(`  - ScrollY: ${window.scrollY}`);
            }
        };
        
        // Initial call
        updateAnchorPosition("init");

        // --- Rounded Rectangle Shape for Card ---
        const createRoundedRectShape = (width, height, radius) => {
            const shape = new THREE.Shape();
            const x = -width / 2;
            const y = -height / 2;
            shape.moveTo(x, y + radius);
            shape.lineTo(x, y + height - radius);
            shape.quadraticCurveTo(x, y + height, x + radius, y + height);
            shape.lineTo(x + width - radius, y + height);
            shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
            shape.lineTo(x + width, y + radius);
            shape.quadraticCurveTo(x + width, y, x + width - radius, y);
            shape.lineTo(x + radius, y);
            shape.quadraticCurveTo(x, y, x, y + radius);
            return shape;
        };

        // --- Dynamic Card Textures ---
        const generateFrontTexture = (imgObj = null) => {
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 716;
            const ctx = c.getContext('2d');

            if (imgObj) {
                const imgAspect = imgObj.width / imgObj.height;
                const canvasAspect = c.width / c.height;
                let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

                if (imgAspect > canvasAspect) {
                    drawHeight = c.height;
                    drawWidth = imgObj.width * (c.height / imgObj.height);
                    offsetX = (c.width - drawWidth) / 2;
                } else {
                    drawWidth = c.width;
                    drawHeight = imgObj.height * (c.width / imgObj.width);
                    offsetY = (c.height - drawHeight) / 2;
                }
                ctx.drawImage(imgObj, offsetX, offsetY, drawWidth, drawHeight);
            } else {
                const grad = ctx.createLinearGradient(0, 0, 0, c.height);
                grad.addColorStop(0, '#141C2F');
                grad.addColorStop(1, '#0B0F1A');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, c.width, c.height);
                
                ctx.fillStyle = 'rgba(0, 112, 209, 0.1)';
                ctx.font = '200px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('HH', c.width/2, c.height/2 + 70);
            }

            const overlayGrad = ctx.createLinearGradient(0, c.height - 250, 0, c.height);
            overlayGrad.addColorStop(0, 'rgba(11, 15, 26, 0)');
            overlayGrad.addColorStop(0.5, 'rgba(11, 15, 26, 0.8)');
            overlayGrad.addColorStop(1, 'rgba(11, 15, 26, 1)');
            ctx.fillStyle = overlayGrad;
            ctx.fillRect(0, c.height - 250, c.width, 250);

            ctx.fillStyle = '#F2F5FA';
            ctx.textAlign = 'center';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText('Hamami Hamzah', c.width/2, c.height - 80);
            
            ctx.fillStyle = '#4A90D9';
            ctx.font = '22px sans-serif';
            ctx.fillText('Full-Stack Developer & IT Explorer', c.width/2, c.height - 45);
            
            ctx.fillStyle = 'rgba(242, 245, 250, 0.5)';
            ctx.font = '16px sans-serif';
            ctx.fillText('△ ○ ✕ □', c.width/2, c.height - 20);

            ctx.strokeStyle = '#0070D1';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, c.width-4, c.height-4);

            return new THREE.CanvasTexture(c);
        };

        const generateBackTexture = () => {
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 716;
            const ctx = c.getContext('2d');

            ctx.fillStyle = '#141C2F';
            ctx.fillRect(0, 0, c.width, c.height);
            const gradient = ctx.createLinearGradient(0, 0, c.width, c.height);
            gradient.addColorStop(0, 'rgba(0, 112, 209, 0.2)');
            gradient.addColorStop(1, 'rgba(11, 15, 26, 0.8)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, c.width, c.height);

            ctx.strokeStyle = '#0070D1';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, c.width-4, c.height-4);

            ctx.fillStyle = '#F2F5FA';
            ctx.textAlign = 'center';
            
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText('CONTACT INFO', c.width/2, 100);
            
            ctx.fillStyle = '#8FA0BF';
            ctx.font = '24px sans-serif';
            ctx.fillText('hantu060614@gmail.com', c.width/2, 160);
            ctx.fillText('github.com/hamamihamzah', c.width/2, 210);
            
            ctx.fillStyle = '#F2F5FA';
            ctx.font = 'bold 32px sans-serif';
            ctx.fillText('TECH STACK', c.width/2, 330);
            
            ctx.fillStyle = '#4A90D9';
            ctx.font = '20px sans-serif';
            const stack = ['HTML/CSS/JS', 'React & Tailwind', 'Supabase & Firebase', 'C++ & Godot', 'Cybersecurity'];
            stack.forEach((item, i) => {
                ctx.fillText(item, c.width/2, 390 + i*40);
            });
            
            ctx.fillStyle = '#F2F5FA';
            ctx.font = 'bold 20px monospace';
            ctx.fillText('ID: DEV-2026-001', c.width/2, 590);
            
            ctx.fillStyle = '#fff';
            ctx.fillRect(c.width/2 - 40, 610, 80, 80);
            ctx.fillStyle = '#000';
            ctx.fillRect(c.width/2 - 30, 620, 60, 60);
            
            return new THREE.CanvasTexture(c);
        };

        const backTex = generateBackTexture();
        let frontTex = generateFrontTexture(null);
        
        // --- Setup Card Mesh ---
        const cardShape = createRoundedRectShape(CONFIG.CARD_WIDTH, CONFIG.CARD_HEIGHT, CONFIG.CORNER_RADIUS);
        const extrudeSettings = { depth: CONFIG.CARD_DEPTH, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 };
        const cardGeo = new THREE.ExtrudeGeometry(cardShape, extrudeSettings);
        cardGeo.translate(0, 0, -CONFIG.CARD_DEPTH / 2);
        
        const cardGroup = new THREE.Group();
        const pivotGroup = new THREE.Group(); 
        
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x141C2F });
        const rim = new THREE.Mesh(cardGeo, rimMat);
        cardGroup.add(rim);

        const faceGeo = new THREE.PlaneGeometry(CONFIG.CARD_WIDTH, CONFIG.CARD_HEIGHT);
        const frontMat = new THREE.MeshPhysicalMaterial({ map: frontTex, roughness: 0.2, metalness: 0.1, clearcoat: 0.8 });
        const frontFace = new THREE.Mesh(faceGeo, frontMat);
        frontFace.position.z = CONFIG.CARD_DEPTH/2 + 0.015;
        cardGroup.add(frontFace);

        const backMat = new THREE.MeshPhysicalMaterial({ map: backTex, roughness: 0.2, metalness: 0.1, clearcoat: 0.8 });
        const backFace = new THREE.Mesh(faceGeo, backMat);
        backFace.rotation.y = Math.PI;
        backFace.position.z = -CONFIG.CARD_DEPTH/2 - 0.015;
        cardGroup.add(backFace);
        
        // Offset card DOWN so the pivot point (0,0,0) of pivotGroup aligns precisely with the top of the metal clip
        cardGroup.position.y = -CONFIG.CARD_HEIGHT/2 - 0.25; 
        pivotGroup.add(cardGroup);
        scene.add(pivotGroup);

        const img = new Image();
        img.src = 'assets/card/foto.jpg';
        img.onload = () => {
            const newTex = generateFrontTexture(img);
            newTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            frontFace.material.map = newTex;
            frontFace.material.needsUpdate = true;
        };

        // --- Anchor & Metal Clip ---
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 });
        
        const pinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16);
        pinGeo.rotateX(Math.PI/2);
        const pin = new THREE.Mesh(pinGeo, metalMat);
        scene.add(pin); 

        const ringGeo = new THREE.TorusGeometry(0.06, 0.015, 16, 32);
        const ring = new THREE.Mesh(ringGeo, metalMat);
        ring.position.y = -0.06; 
        pivotGroup.add(ring);
        
        const clipGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2);
        const clip = new THREE.Mesh(clipGeo, metalMat);
        clip.position.y = -0.18;
        pivotGroup.add(clip);

        // --- Rope (Verlet Physics) ---
        const segmentLength = CONFIG.ROPE_LENGTH / CONFIG.ROPE_SEGMENTS;
        const ropePoints = [];
        const ropeOldPoints = [];
        
        for(let i=0; i<=CONFIG.ROPE_SEGMENTS; i++) {
            ropePoints.push(new THREE.Vector3(anchorPos.x, anchorPos.y - i*segmentLength, 0));
            ropeOldPoints.push(new THREE.Vector3(anchorPos.x, anchorPos.y - i*segmentLength, 0));
        }

        // --- Rope Texture (SECGHOST text) ---
        const strapCanvas = document.createElement('canvas');
        strapCanvas.width = 128;
        strapCanvas.height = 1024;
        const sCtx = strapCanvas.getContext('2d');
        
        sCtx.fillStyle = '#0A0A0A';
        sCtx.fillRect(0, 0, strapCanvas.width, strapCanvas.height);
        
        sCtx.strokeStyle = '#222222';
        sCtx.lineWidth = 4;
        sCtx.setLineDash([8, 8]);
        sCtx.beginPath();
        sCtx.moveTo(8, 0); sCtx.lineTo(8, 1024);
        sCtx.moveTo(120, 0); sCtx.lineTo(120, 1024);
        sCtx.stroke();

        sCtx.fillStyle = '#F5F5F5';
        sCtx.font = 'bold 50px sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        
        sCtx.save();
        sCtx.translate(64, 512);
        sCtx.rotate(Math.PI / 2);
        sCtx.fillText('SECGHOST  •  SECGHOST  •  SECGHOST', 0, 0);
        sCtx.restore();
        
        const strapTex = new THREE.CanvasTexture(strapCanvas);
        strapTex.colorSpace = THREE.SRGBColorSpace;
        strapTex.wrapS = THREE.RepeatWrapping;
        strapTex.wrapT = THREE.RepeatWrapping;
        strapTex.repeat.set(1, 1); // Exact fit for the text
        strapTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const strapMat = new THREE.MeshStandardMaterial({
            map: strapTex,
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.0,
            color: 0xeeeeee
        });

        // --- Billboard Ribbon Geometry (Always faces camera, prevents twist) ---
        const ribbonGeo = new THREE.BufferGeometry();
        const numVertices = (CONFIG.ROPE_SEGMENTS + 1) * 2;
        const positions = new Float32Array(numVertices * 3);
        const uvs = new Float32Array(numVertices * 2);
        const indices = [];

        for (let i = 0; i < CONFIG.ROPE_SEGMENTS; i++) {
            const v1 = i * 2;
            const v2 = i * 2 + 1;
            const v3 = (i + 1) * 2;
            const v4 = (i + 1) * 2 + 1;
            indices.push(v1, v2, v3);
            indices.push(v2, v4, v3);
        }

        for (let i = 0; i <= CONFIG.ROPE_SEGMENTS; i++) {
            const v = i / CONFIG.ROPE_SEGMENTS;
            uvs[i * 4 + 0] = 0; // u = 0
            uvs[i * 4 + 1] = v; // v
            uvs[i * 4 + 2] = 1; // u = 1
            uvs[i * 4 + 3] = v; // v
        }

        ribbonGeo.setIndex(indices);
        ribbonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        ribbonGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        ribbonGeo.computeVertexNormals(); // Initialize normals for lighting

        const ropeMesh = new THREE.Mesh(ribbonGeo, strapMat);
        ropeMesh.frustumCulled = false; // Prevents the mesh from flickering/disappearing when bounding box isn't updated
        scene.add(ropeMesh);

        // --- Interaction Logic ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let isDragging = false;
        let dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        let dragOffset = new THREE.Vector3();
        let cardFlipped = false;
        let mouseTarget = new THREE.Vector3();

        const getIntersect = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            if (clientX === undefined) return null;
            mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            return raycaster.intersectObject(frontFace);
        };

        const onDown = (e) => {
            const intersects = getIntersect(e);
            if (intersects && intersects.length > 0 || raycaster.intersectObject(backFace).length > 0) {
                isDragging = true;
                document.body.style.cursor = 'grabbing';
                raycaster.ray.intersectPlane(dragPlane, mouseTarget);
                dragOffset.copy(mouseTarget).sub(pivotGroup.position);
            }
        };

        const onMove = (e) => {
            if (!isDragging) {
                const intersects = getIntersect(e);
                canvas.style.cursor = (intersects && intersects.length > 0) ? 'grab' : 'default';
                return;
            }
            getIntersect(e);
            raycaster.ray.intersectPlane(dragPlane, mouseTarget);
            
            const boundMinX = anchorPos.x - 6.0;
            const boundMaxX = Math.min(columnBoundsX, anchorPos.x + 6.0); 
            const boundY = anchorPos.y - CONFIG.ROPE_LENGTH - 3.0;
            
            if (mouseTarget.y < boundY) mouseTarget.y = boundY;
            if (mouseTarget.x > boundMaxX) mouseTarget.x = boundMaxX;
            if (mouseTarget.x < boundMinX) mouseTarget.x = boundMinX;
            
            if(e.cancelable) e.preventDefault(); 
        };

        const onUp = () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = 'auto';
            }
        };

        const onClick = (e) => {
            if(isDragging) return;
            const intersectsFront = getIntersect(e);
            const intersectsBack = raycaster.intersectObject(backFace);
            if ((intersectsFront && intersectsFront.length > 0) || (intersectsBack && intersectsBack.length > 0)) {
                cardFlipped = !cardFlipped;
                gsap.to(pivotGroup.rotation, {
                    y: cardFlipped ? Math.PI : 0,
                    duration: 0.8,
                    ease: "back.out(1.5)"
                });
            }
        };

        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('touchstart', onDown, {passive: false});
        window.addEventListener('touchmove', onMove, {passive: false});
        window.addEventListener('touchend', onUp);

        // --- Robust Anchor Update Triggers ---
        const handleLanyardResize = () => {
            if (!container || !canvas) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));
            updateAnchorPosition("resize");
        };
        window.addEventListener('resize', handleLanyardResize);
        window.addEventListener('orientationchange', () => {
            setTimeout(handleLanyardResize, 300);
        });
        
        window.addEventListener('scroll', () => updateAnchorPosition("scroll"), {passive: true});

        if (document.fonts) {
            document.fonts.ready.then(() => updateAnchorPosition("fonts.ready"));
        }
        
        window.addEventListener('load', () => updateAnchorPosition("window.load"));
        
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.addEventListener("refresh", () => updateAnchorPosition("ScrollTrigger.refresh"));
        }

        // Failsafe repeated updates for the first 2 seconds to catch GSAP entrance animations
        let safetyCounter = 0;
        const safetyInterval = setInterval(() => {
            updateAnchorPosition("safetyInterval");
            safetyCounter++;
            if (safetyCounter > 10) clearInterval(safetyInterval);
        }, 200);

        let isVisible = false;
        const observer = new IntersectionObserver((entries) => {
            isVisible = entries[0].isIntersecting;
            if(isVisible && ropePoints[CONFIG.ROPE_SEGMENTS].y === anchorPos.y - CONFIG.ROPE_LENGTH) {
                ropePoints[CONFIG.ROPE_SEGMENTS].x = anchorPos.x + 2.0; 
                ropePoints[CONFIG.ROPE_SEGMENTS].z = 1.0;
            }
        }, { threshold: 0.1 });
        observer.observe(container);

        // --- Physics Engine (Fixed Timestep) ---
        const dt = 1/60;
        let accumulator = 0;
        const gravity = new THREE.Vector3(0, -20.0, 0); 

        const updatePhysics = () => {
            if (isDragging) {
                const targetPoint = mouseTarget.clone().sub(dragOffset);
                const lastPt = ropePoints[CONFIG.ROPE_SEGMENTS];
                const force = targetPoint.sub(lastPt).multiplyScalar(CONFIG.DRAG_STIFFNESS);
                lastPt.add(force);
                // Kill extreme velocity so it feels like you're holding it solidly
                ropeOldPoints[CONFIG.ROPE_SEGMENTS].copy(lastPt); 
            }

            for(let i = 1; i <= CONFIG.ROPE_SEGMENTS; i++) {
                const current = ropePoints[i];
                const old = ropeOldPoints[i];
                
                const velocity = current.clone().sub(old);
                velocity.multiplyScalar(CONFIG.DAMPING_LINEAR); 
                
                old.copy(current);
                current.add(velocity).add(gravity.clone().multiplyScalar(dt * dt));
            }

            for(let k = 0; k < CONFIG.CONSTRAINT_ITERATIONS; k++) {
                for(let i = 0; i < CONFIG.ROPE_SEGMENTS; i++) {
                    const p1 = ropePoints[i];
                    const p2 = ropePoints[i+1];
                    const delta = p2.clone().sub(p1);
                    const dist = delta.length();
                    
                    if (dist > 0) {
                        const diff = (dist - segmentLength) / dist;
                        const offset = delta.multiplyScalar(0.5 * diff);
                        
                        if(i === 0) {
                            p2.sub(offset.multiplyScalar(2));
                        } else {
                            p1.add(offset);
                            p2.sub(offset);
                        }
                    }
                }
            }
            ropePoints[0].copy(anchorPos); 
        };

        const animate = () => {
            requestAnimationFrame(animate);
            if (!isVisible || !isReady || document.hidden) return; 

            if (!prefersReducedMotion) {
                accumulator += clock.getDelta();
                if (accumulator > 0.1) accumulator = 0.1;
                
                while(accumulator >= dt) {
                    updatePhysics();
                    accumulator -= dt;
                }

                // Update Ribbon Geometry
                const posArray = ribbonGeo.attributes.position.array;
                const camPos = camera.position;

                for (let i = 0; i <= CONFIG.ROPE_SEGMENTS; i++) {
                    const point = ropePoints[i];
                    const tangent = new THREE.Vector3();
                    
                    if (i === 0) {
                        tangent.subVectors(ropePoints[1], ropePoints[0]);
                    } else if (i === CONFIG.ROPE_SEGMENTS) {
                        tangent.subVectors(ropePoints[i], ropePoints[i - 1]);
                    } else {
                        tangent.subVectors(ropePoints[i + 1], ropePoints[i - 1]);
                    }

                    if (tangent.lengthSq() < 0.0001) tangent.set(0, -1, 0);
                    tangent.normalize();

                    const toCam = new THREE.Vector3().subVectors(camPos, point).normalize();
                    const right = new THREE.Vector3().crossVectors(tangent, toCam);
                    if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
                    right.normalize();
                    right.multiplyScalar(0.14); // Half-width of the strap

                    posArray[i * 6 + 0] = point.x + right.x;
                    posArray[i * 6 + 1] = point.y + right.y;
                    posArray[i * 6 + 2] = point.z + right.z;

                    posArray[i * 6 + 3] = point.x - right.x;
                    posArray[i * 6 + 4] = point.y - right.y;
                    posArray[i * 6 + 5] = point.z - right.z;
                }
                ribbonGeo.attributes.position.needsUpdate = true;
                ribbonGeo.computeVertexNormals(); // Crucial for MeshStandardMaterial to interact with lights properly!

                // STRICT KINEMATIC CHAIN: pivotGroup IS ALWAYS exactly at the last rope point.
                const lastPoint = ropePoints[CONFIG.ROPE_SEGMENTS];
                const prevPoint = ropePoints[CONFIG.ROPE_SEGMENTS - 1];
                
                pivotGroup.position.copy(lastPoint);
                pin.position.copy(anchorPos);
                
                const dir = lastPoint.clone().sub(prevPoint).normalize();
                
                if (Math.abs(dir.x) > Math.sin(CONFIG.MAX_SWING_ANGLE)) {
                    dir.x = Math.sign(dir.x) * Math.sin(CONFIG.MAX_SWING_ANGLE);
                    dir.normalize();
                }

                const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
                
                // Let it naturally orient to the rope even during dragging
                pivotGroup.quaternion.slerp(quaternion, 0.6);
                
                if(!isDragging) {
                    pivotGroup.rotation.z *= CONFIG.DAMPING_ANGULAR; 
                }
                
            } else {
                pin.position.copy(anchorPos);
                pivotGroup.position.set(anchorPos.x, anchorPos.y - CONFIG.ROPE_LENGTH, 0);
            }

            renderer.render(scene, camera);
        };

        const clock = new THREE.Clock();
        animate();
        if (DEBUG) console.log("[lanyard.js] Animation loop started.");

    } catch (e) {
        console.error("[lanyard.js] FATAL ERROR IN INIT:", e);
        const fallback = document.querySelector('.lanyard-fallback');
        if(fallback) {
            fallback.classList.remove('sr-only');
            fallback.style.position = 'relative';
        }
    }
};

window.addEventListener('load', () => {
    setTimeout(initLanyard, 100);
});
