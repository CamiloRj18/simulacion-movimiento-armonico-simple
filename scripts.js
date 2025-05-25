        // Global variables
        let scene, camera, renderer, building, controls;
        let floors = [];
        let floorCount = 5;
        let isSimulating = false;
        let simulationTime = 0;
        let animationId;
        
        // Physics parameters
        let amplitude = 1.0;
        let frequency = 0.5;
        let damping = 0.05;
        
        // Performance monitoring
        let lastTime = 0;
        let frameCount = 0;
        let fps = 60;
        
        // Initialize the application
        init();
        
        function init() {
            initThreeJS();
            createBuilding();
            updateFloorMonitors();
            setupEventListeners();
            animate();
        }
        
        function initThreeJS() {
            const container = document.getElementById('canvas-container');
            
            // Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a202c);
            scene.fog = new THREE.Fog(0x1a202c, 10, 100);
            
            // Camera
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(15, 10, 15);
            camera.lookAt(0, 5, 0);
            
            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.setClearColor(0x1a202c);
            
            container.appendChild(renderer.domElement);
            
            // Lighting
            const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
            scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 20, 10);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            scene.add(directionalLight);
            
            const pointLight = new THREE.PointLight(0x64b5f6, 0.5, 50);
            pointLight.position.set(-10, 15, -10);
            scene.add(pointLight);
            
            // Ground
            const groundGeometry = new THREE.PlaneGeometry(50, 50);
            const groundMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x2d3748,
                transparent: true,
                opacity: 0.7
            });
            const ground = new THREE.Mesh(groundGeometry, groundMaterial);
            ground.rotation.x = -Math.PI / 2;
            ground.receiveShadow = true;
            scene.add(ground);
            
            // Grid
            const gridHelper = new THREE.GridHelper(50, 50, 0x4a5568, 0x2d3748);
            scene.add(gridHelper);
            
            // Mouse controls (simplified orbital)
            setupMouseControls();
            
            // Hide loading
            document.querySelector('.loading').style.display = 'none';
        }
        
        function setupMouseControls() {
            let mouseDown = false;
            let mouseButton = 0;
            let mouseX = 0;
            let mouseY = 0;
            
            const canvas = renderer.domElement;
            
            canvas.addEventListener('mousedown', (event) => {
                mouseDown = true;
                mouseButton = event.button;
                mouseX = event.clientX;
                mouseY = event.clientY;
            });
            
            canvas.addEventListener('mouseup', () => {
                mouseDown = false;
            });
            
            canvas.addEventListener('mousemove', (event) => {
                if (!mouseDown) return;
                
                const deltaX = event.clientX - mouseX;
                const deltaY = event.clientY - mouseY;
                
                if (mouseButton === 0) { // Left click - rotate
                    const spherical = new THREE.Spherical();
                    spherical.setFromVector3(camera.position);
                    
                    spherical.theta -= deltaX * 0.01;
                    spherical.phi += deltaY * 0.01;
                    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                    
                    camera.position.setFromSpherical(spherical);
                    camera.lookAt(0, floorCount * 1.5, 0);
                }
                
                mouseX = event.clientX;
                mouseY = event.clientY;
            });
            
            canvas.addEventListener('wheel', (event) => {
                const distance = camera.position.length();
                const newDistance = Math.max(5, Math.min(50, distance + event.deltaY * 0.01));
                camera.position.normalize().multiplyScalar(newDistance);
                camera.lookAt(0, floorCount * 1.5, 0);
            });
        }
        
        function createBuilding() {
            // Remove existing building
            if (building) {
                scene.remove(building);
            }
            
            building = new THREE.Group();
            floors = [];
            
            for (let i = 0; i < floorCount; i++) {
                const floorGroup = new THREE.Group();
                
                // Floor structure
                const floorGeometry = new THREE.BoxGeometry(4, 0.2, 3);
                const floorMaterial = new THREE.MeshLambertMaterial({ 
                    color: i === 0 ? 0x4a5568 : 0x2d3748 
                });
                const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
                floorMesh.position.y = i * 3;
                floorMesh.castShadow = true;
                floorMesh.receiveShadow = true;
                
                // Columns
                for (let x = -1.5; x <= 1.5; x += 3) {
                    for (let z = -1; z <= 1; z += 2) {
                        if (i < floorCount - 1) {
                            const columnGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3);
                            const columnMaterial = new THREE.MeshLambertMaterial({ color: 0x718096 });
                            const column = new THREE.Mesh(columnGeometry, columnMaterial);
                            column.position.set(x, i * 3 + 1.5, z);
                            column.castShadow = true;
                            floorGroup.add(column);
                        }
                    }
                }
                
                // Windows (for visual appeal)
                if (i > 0) {
                    for (let side = -1; side <= 1; side += 2) {
                        const windowGeometry = new THREE.PlaneGeometry(0.8, 1.5);
                        const windowMaterial = new THREE.MeshLambertMaterial({ 
                            color: 0x64b5f6,
                            transparent: true,
                            opacity: 0.6
                        });
                        const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
                        window1.position.set(side * 2, i * 3 + 0.7, 0);
                        window1.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
                        floorGroup.add(window1);
                    }
                }
                
                // Floor label
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 128;
                canvas.height = 64;
                context.fillStyle = '#64b5f6';
                context.font = 'Bold 24px Arial';
                context.textAlign = 'center';
                context.fillText(`P${i + 1}`, 64, 40);
                
                const texture = new THREE.CanvasTexture(canvas);
                const labelMaterial = new THREE.SpriteMaterial({ map: texture });
                const label = new THREE.Sprite(labelMaterial);
                label.position.set(2.5, i * 3 + 0.5, 0);
                label.scale.set(1, 0.5, 1);
                floorGroup.add(label);
                
                floorGroup.add(floorMesh);
                floors.push(floorGroup);
                building.add(floorGroup);
            }
            
            scene.add(building);
            updateStatusBar();
        }
        
        function updateFloorMonitors() {
            const container = document.getElementById('floor-monitors');
            container.innerHTML = '';
            
            for (let i = 0; i < floorCount; i++) {
                const monitor = document.createElement('div');
                monitor.className = 'floor-monitor';
                monitor.innerHTML = `
                    <div class="floor-label">Piso ${i + 1}</div>
                    <div class="displacement-bar">
                        <div class="displacement-fill" id="floor-${i}-bar"></div>
                    </div>
                    <div class="displacement-value" id="floor-${i}-value">0.00 m</div>
                `;
                container.appendChild(monitor);
            }
        }
        
        function setupEventListeners() {
            // Tab switching
            document.getElementById('simulation-tab-btn').addEventListener('click', () => switchTab('simulation'));
            document.getElementById('guide-tab-btn').addEventListener('click', () => switchTab('guide'));
            
            // Floor controls
            document.getElementById('decrease-floors').addEventListener('click', () => changeFloors(-1));
            document.getElementById('increase-floors').addEventListener('click', () => changeFloors(1));
            
            // Simulation control
            document.getElementById('sim-btn').addEventListener('click', toggleSimulation);
            
            // Scenario buttons
            document.getElementById('earthquake-scenario').addEventListener('click', () => loadScenario('earthquake'));
            document.getElementById('wind-scenario').addEventListener('click', () => loadScenario('wind'));
            document.getElementById('modern-scenario').addEventListener('click', () => loadScenario('modern'));
            
            // Camera controls
            document.getElementById('reset-camera').addEventListener('click', resetCamera);
            document.getElementById('top-view').addEventListener('click', topView);
            document.getElementById('side-view').addEventListener('click', sideView);
            document.getElementById('front-view').addEventListener('click', frontView);
            
            // Sliders
            document.getElementById('amplitude').addEventListener('input', (e) => {
                amplitude = parseFloat(e.target.value);
                document.getElementById('amplitude-value').textContent = amplitude.toFixed(1);
            });
            
            document.getElementById('frequency').addEventListener('input', (e) => {
                frequency = parseFloat(e.target.value);
                document.getElementById('frequency-value').textContent = frequency.toFixed(1);
            });
            
            document.getElementById('damping').addEventListener('input', (e) => {
                damping = parseFloat(e.target.value);
                document.getElementById('damping-value').textContent = damping.toFixed(2);
            });
            
            // Window resize
            window.addEventListener('resize', onWindowResize);
        }
        
        function onWindowResize() {
            const container = document.getElementById('canvas-container');
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
        
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.getElementById(`${tabName}-tab-btn`).classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        }
        
        function changeFloors(delta) {
            floorCount = Math.max(1, Math.min(20, floorCount + delta));
            document.getElementById('floor-count').textContent = floorCount;
            createBuilding();
            updateFloorMonitors();
        }
        
        function toggleSimulation() {
            isSimulating = !isSimulating;
            const btn = document.getElementById('sim-btn');
            
            if (isSimulating) {
                btn.textContent = '⏹️ Detener Simulación';
                btn.className = 'simulation-btn stop';
                simulationTime = 0;
            } else {
                btn.textContent = '▶️ Iniciar Simulación';
                btn.className = 'simulation-btn start';
                resetBuildingPosition();
            }
            
            updateStatusBar();
        }
        
        function loadScenario(type) {
            switch (type) {
                case 'earthquake':
                    amplitude = 3.5;
                    frequency = 1.2;
                    damping = 0.08;
                    break;
                case 'wind':
                    amplitude = 2.0;
                    frequency = 0.4;
                    damping = 0.15;
                    break;
                case 'modern':
                    amplitude = 1.5;
                    frequency = 2.0;
                    damping = 0.25;
                    break;
            }
            
            // Update UI
            document.getElementById('amplitude').value = amplitude;
            document.getElementById('amplitude-value').textContent = amplitude.toFixed(1);
            document.getElementById('frequency').value = frequency;
            document.getElementById('frequency-value').textContent = frequency.toFixed(1);
            document.getElementById('damping').value = damping;
            document.getElementById('damping-value').textContent = damping.toFixed(2);
        }
        
        function resetCamera() {
            camera.position.set(15, 10, 15);
            camera.lookAt(0, floorCount * 1.5, 0);
        }
        
        function topView() {
            camera.position.set(0, 25, 0);
            camera.lookAt(0, 0, 0);
        }
        
        function sideView() {
            camera.position.set(20, 10, 0);
            camera.lookAt(0, floorCount * 1.5, 0);
        }
        
        function frontView() {
            camera.position.set(0, 10, 20);
            camera.lookAt(0, floorCount * 1.5, 0);
        }
        
        function resetBuildingPosition() {
            floors.forEach((floor, index) => {
                // Reset to original grounded position
                floor.position.x = 0;
                floor.position.y = 0; // Keep floors grounded
                floor.position.z = 0;
                
                // Reset all rotations
                floor.rotation.x = 0;
                floor.rotation.y = 0;
                floor.rotation.z = 0;
            });
        }
        
        function updateStatusBar() {
            const indicator = document.getElementById('sim-indicator');
            const status = document.getElementById('sim-status');
            const floorsDisplay = document.getElementById('status-floors');
            
            indicator.className = isSimulating ? 'status-indicator' : 'status-indicator inactive';
            status.textContent = isSimulating ? 'Simulación Activa' : 'Simulación Detenida';
            floorsDisplay.textContent = floorCount;
        }
        
        function updateSimulation() {
            if (!isSimulating) return;
            
            simulationTime += 0.016; // ~60fps
            
            floors.forEach((floor, index) => {
                if (index === 0) {
                    // FOUNDATION FLOOR - COMPLETELY STATIC (like real buildings)
                    floor.position.x = 0;
                    floor.position.y = 0;
                    floor.position.z = 0;
                    floor.rotation.x = 0;
                    floor.rotation.y = 0;
                    floor.rotation.z = 0;
                    
                    // Update monitor for foundation (should show 0)
                    const bar = document.getElementById(`floor-${index}-bar`);
                    const value = document.getElementById(`floor-${index}-value`);
                    if (bar && value) {
                        bar.style.width = '0%';
                        value.textContent = '0.00 m';
                    }
                } else {
                    // UPPER FLOORS - Progressive movement (realistic physics)
                    // Height factor: how much this floor is affected (0 for foundation, max for top)
                    const heightRatio = index / (floorCount - 1); // 0 to 1 from bottom to top
                    const heightFactor = heightRatio * heightRatio; // Quadratic increase for realism
                    
                    // Damped harmonic oscillator equation
                    const dampingFactor = Math.exp(-damping * simulationTime);
                    const baseMotion = amplitude * dampingFactor * 
                                     Math.cos(2 * Math.PI * frequency * simulationTime);
                    
                    // Progressive displacement - only upper floors move
                    const displacement = baseMotion * heightFactor;
                    
                    // Apply realistic movement
                    floor.position.x = displacement;
                    floor.position.y = 0; // Keep structural height
                    floor.position.z = 0;
                    
                    // Realistic building sway - progressive rotation from base (static) to top (max)
                    floor.rotation.z = displacement * 0.05 * heightRatio;
                    floor.rotation.x = 0;
                    floor.rotation.y = 0;
                    
                    // Update monitor
                    const maxPossibleDisplacement = amplitude * heightFactor;
                    const percentage = maxPossibleDisplacement > 0 ? 
                                     (Math.abs(displacement) / maxPossibleDisplacement) * 100 : 0;
                    const bar = document.getElementById(`floor-${index}-bar`);
                    const value = document.getElementById(`floor-${index}-value`);
                    
                    if (bar && value) {
                        bar.style.width = `${Math.min(100, percentage)}%`;
                        value.textContent = displacement.toFixed(2) + ' m';
                    }
                }
            });
            
            // Update time display
            document.getElementById('time-display').textContent = simulationTime.toFixed(2) + 's';
        }
        
        function animate() {
            animationId = requestAnimationFrame(animate);
            
            // Update simulation
            updateSimulation();
            
            // FPS calculation
            const currentTime = performance.now();
            if (currentTime - lastTime >= 1000) {
                fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                document.getElementById('fps-display').textContent = fps;
                frameCount = 0;
                lastTime = currentTime;
            }
            frameCount++;
            
            // Render
            renderer.render(scene, camera);
        }