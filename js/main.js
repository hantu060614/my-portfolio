// main.js - Core functionality, GSAP animations, responsive interactions

console.log("[main.js] Initializing...");

// Responsive Pointer and Accessibility checks
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hide Preloader Utility (Failsafe)
const hidePreloader = () => {
    const preloader = document.querySelector('.preloader');
    const body = document.body;
    if (preloader && preloader.style.display !== 'none') {
        console.log("[main.js] Hiding preloader...");
        gsap.to(preloader, {
            opacity: 0,
            duration: 0.7,
            ease: "power2.inOut",
            onComplete: () => {
                preloader.style.display = 'none';
                body.classList.remove('loading');
                initHeroAnimations();
            }
        });
    }
};

// PRELOADER FAILSAFE: Force hide after 2.5 seconds regardless of loading state
const failsafeTimer = setTimeout(() => {
    console.warn("[main.js] Preloader failsafe triggered.");
    hidePreloader();
}, 2500);

// Normal Preloader Logic
window.addEventListener('load', () => {
    console.log("[main.js] Window loaded.");
    clearTimeout(failsafeTimer);
    setTimeout(hidePreloader, 400);
});

// Initialize Lenis Smooth Scroll
let lenis;
try {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    console.log("[main.js] Lenis initialized.");
} catch (e) {
    console.error("[main.js] Failed to initialize Lenis:", e);
}

// GSAP Animations Registration
try {
    gsap.registerPlugin(ScrollTrigger);
    console.log("[main.js] GSAP registered.");
} catch(e) {
    console.error("[main.js] Failed to register GSAP:", e);
}

// Mouse Interactions (Fine pointer only)
try {
    if (hasFinePointer && !prefersReducedMotion) {
        window.addEventListener('mousemove', (e) => {
            document.querySelectorAll('.tilt-card').forEach(card => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        });

        // Magnetic Elements
        const magneticElements = document.querySelectorAll('[data-magnetic]');
        magneticElements.forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = (e.clientX - rect.left) - rect.width / 2;
                const y = (e.clientY - rect.top) - rect.height / 2;
                
                gsap.to(el, {
                    x: x * 0.35,
                    y: y * 0.35,
                    duration: 0.5,
                    ease: "power3.out"
                });
            });
            
            el.addEventListener('mouseleave', () => {
                gsap.to(el, {
                    x: 0,
                    y: 0,
                    duration: 0.6,
                    ease: "elastic.out(1, 0.3)"
                });
            });
        });

        // 3D Tilt Cards with Safe Clamping (max +-4 degrees, no offset shifts)
        const tiltCards = document.querySelectorAll('.tilt-card');
        tiltCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                // Strict clamping so card never clips or jumps out of layout
                const rawRotX = ((y - centerY) / centerY) * -4;
                const rawRotY = ((x - centerX) / centerX) * 4;
                const rotateX = Math.max(-4, Math.min(4, rawRotX));
                const rotateY = Math.max(-4, Math.min(4, rawRotY));
                
                gsap.to(card, {
                    rotateX: rotateX,
                    rotateY: rotateY,
                    transformPerspective: 1200,
                    transformOrigin: "center center",
                    duration: 0.35,
                    ease: "power2.out"
                });
            });
            
            card.addEventListener('mouseleave', () => {
                gsap.to(card, {
                    rotateX: 0,
                    rotateY: 0,
                    duration: 0.5,
                    ease: "power2.out"
                });
            });
        });
    }
} catch (e) {
    console.error("[main.js] Interaction logic failed:", e);
}

// Hero Entrance Animations
function initHeroAnimations() {
    if (prefersReducedMotion) return;
    try {
        const tl = gsap.timeline();
        tl.from(".hero .reveal-text", {
            y: 40,
            opacity: 0,
            duration: 0.9,
            stagger: 0.12,
            ease: "power3.out"
        })
        .from(".scroll-indicator", {
            opacity: 0,
            y: -15,
            duration: 0.7,
            ease: "power2.out"
        }, "-=0.4");
        console.log("[main.js] Hero entrance animated.");
    } catch (e) {
        console.error("[main.js] Hero entrance failed:", e);
    }
}

// Scroll Reveals & Stats Counter
try {
    if (!prefersReducedMotion) {
        // Section Title Reveals
        gsap.utils.toArray('.section-title').forEach(title => {
            gsap.from(title, {
                scrollTrigger: {
                    trigger: title,
                    start: "top 85%",
                    toggleActions: "play none none reverse"
                },
                y: 35,
                opacity: 0,
                duration: 0.8,
                ease: "power3.out"
            });
        });

        // About Stats Counter
        const counters = document.querySelectorAll('.counter');
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'), 10);
            ScrollTrigger.create({
                trigger: counter,
                start: "top 90%",
                onEnter: () => {
                    gsap.to(counter, {
                        innerHTML: target,
                        duration: 1.8,
                        snap: { innerHTML: 1 },
                        ease: "power2.out",
                        onUpdate: function() {
                            counter.innerHTML = Math.round(this.targets()[0].innerHTML) + (target > 10 ? '+' : '');
                        }
                    });
                },
                once: true
            });
        });

        // Fade Up Elements
        gsap.utils.toArray('.about-text p, .skill-category, .project-card, .timeline-item').forEach(el => {
            gsap.from(el, {
                scrollTrigger: {
                    trigger: el,
                    start: "top 88%",
                    toggleActions: "play none none reverse"
                },
                y: 40,
                opacity: 0,
                duration: 0.75,
                ease: "power3.out"
            });
        });
    } else {
        // Immediate values for reduced motion
        document.querySelectorAll('.counter').forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'), 10);
            counter.innerHTML = target + (target > 10 ? '+' : '');
        });
    }
} catch (e) {
    console.error("[main.js] Scroll animations failed:", e);
}

// Navbar & Accessibility & Mobile Menu
try {
    let lastScrollY = window.scrollY;
    const navbar = document.querySelector('.navbar');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    // Smart Navbar hide on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > lastScrollY && window.scrollY > 120 && !navLinks.classList.contains('active')) {
            navbar.classList.add('hidden');
        } else {
            navbar.classList.remove('hidden');
        }
        lastScrollY = window.scrollY;
    }, { passive: true });

    // Menu Toggle Controller
    const toggleMenu = (open) => {
        if (!menuToggle || !navLinks) return;
        const isActive = typeof open === 'boolean' ? open : !navLinks.classList.contains('active');
        menuToggle.classList.toggle('active', isActive);
        navLinks.classList.toggle('active', isActive);
        menuToggle.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        document.body.classList.toggle('menu-open', isActive);
    };

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => toggleMenu());

        // Close on nav link click
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                toggleMenu(false);
            });
        });

        // Close on Escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                toggleMenu(false);
                menuToggle.focus();
            }
        });
    }

    // Active Section Link Highlight
    const sections = document.querySelectorAll('section[id]');
    const navLinkEls = document.querySelectorAll('.nav-link');
    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY + 200;
        sections.forEach(sec => {
            const top = sec.offsetTop;
            const height = sec.offsetHeight;
            const id = sec.getAttribute('id');
            if (scrollPosition >= top && scrollPosition < top + height) {
                navLinkEls.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    }, { passive: true });

    // Back to Top Button
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            if (lenis) lenis.scrollTo(0, { duration: 1.4 });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Contact Form Demo Submission Handler
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Pesan Terkirim! ✓";
            submitBtn.style.background = "#3ECF8E";
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.style.background = "";
                contactForm.reset();
            }, 3000);
        });
    }
} catch (e) {
    console.error("[main.js] Navigation logic failed:", e);
}

console.log("[main.js] Setup complete.");
