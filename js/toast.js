// Lightweight toast helper used across pages
(function(){
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    function showToast(message, type = 'success', duration = 3000) {
        if (!toast || !toastMessage || !toastIcon) return;
        toastMessage.textContent = message;

        if (type === 'success') {
            toast.classList.remove('bg-red-600');
            toast.classList.add('bg-[#600000]', 'text-white');
            toastIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
        } else if (type === 'error') {
            toast.classList.remove('bg-[#600000]');
            toast.classList.add('bg-red-600', 'text-white');
            toastIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 1.677A9 9 0 0112 21c4.486 0 8.441-1.879 11.303-4.908m-10.303-1.677a9.001 9.001 0 01-7.222-3.664M15 9.75l-3-3m0 0l-3 3m3-3v12" />';
        }

        toast.classList.remove('opacity-0');
        toast.classList.add('opacity-100');

        setTimeout(() => {
            toast.classList.remove('opacity-100');
            toast.classList.add('opacity-0');
        }, duration);
    }

    window.showToast = showToast;
})();
