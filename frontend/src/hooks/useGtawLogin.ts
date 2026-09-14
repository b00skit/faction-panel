import api from '../api';
import toast from 'react-hot-toast';

export const useGtawLogin = (redirectPath: string) => {
    const handleGtawLogin = async () => {
        try {
            localStorage.setItem('gtaw_auth_redirect', redirectPath);
            const response = await api.get('/auth/gtaw/redirect');
            window.location.href = response.data.url;
        } catch (err) {
            toast.error('Failed to initialize GTA:W login');
        }
    };

    return handleGtawLogin;
};
