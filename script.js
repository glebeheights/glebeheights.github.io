document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('mobile-toggle');

    // Mobile navigation toggle
    toggle.addEventListener('click', () => {
        nav.classList.toggle('active');
        toggle.classList.toggle('active');
    });

    // Close mobile nav when a link is clicked
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('active');
            toggle.classList.remove('active');
        });
    });

    // Header scroll effect
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        header.classList.toggle('scrolled', currentScroll > 50);
        lastScroll = currentScroll;
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.amenity-card, .event-card, .update-card, .contact-card, .highlight-card, .collage-grid-img').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add animation class styles
    const style = document.createElement('style');
    style.textContent = `
        .animate-in { opacity: 1 !important; transform: translateY(0) !important; }
        .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.3s ease; }
        .lightbox.active { opacity: 1; }
        .lightbox img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.5); }
    `;
    document.head.appendChild(style);

    // Lightbox for collage images
    document.querySelectorAll('.collage-grid-img').forEach(img => {
        img.addEventListener('click', () => {
            const lightbox = document.createElement('div');
            lightbox.className = 'lightbox';
            lightbox.innerHTML = `<img src="${img.src}" alt="${img.alt}">`;
            document.body.appendChild(lightbox);
            requestAnimationFrame(() => lightbox.classList.add('active'));
            lightbox.addEventListener('click', () => {
                lightbox.classList.remove('active');
                setTimeout(() => lightbox.remove(), 300);
            });
        });
    });
});
