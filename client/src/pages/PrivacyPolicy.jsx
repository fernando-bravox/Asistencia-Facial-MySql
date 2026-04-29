import React from "react";
import { useNavigate, Link } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-brand-border">
        <div className="bg-brand-primary p-10 text-center">
          <h1 className="text-4xl font-black text-white tracking-tighter">Política de Privacidad</h1>
          <p className="text-white/80 font-bold uppercase tracking-widest mt-2 text-sm">Protección de Datos Biométricos</p>
        </div>
        
        <div className="p-10 space-y-8 text-brand-dark leading-relaxed">
          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">1. Tratamiento de Datos Biométricos</h2>
            <p className="font-medium text-brand-gray text-justify">
              Este sistema utiliza tecnología de reconocimiento facial de última generación. Es fundamental que el usuario comprenda que <strong>no se almacenan fotografías ni videos</strong> en nuestras bases de datos. El proceso captura una imagen temporal, extrae un <strong>vector matemático (hash)</strong> único de 128 puntos característicos y elimina la imagen original de inmediato.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">2. Almacenamiento y Cifrado</h2>
            <p className="font-medium text-brand-gray text-justify">
              Los descriptores faciales generados se almacenan en servidores institucionales protegidos por múltiples capas de seguridad y cifrado AES-256. Esta información es <strong>intransferible e irreversible</strong>, lo que significa que nadie puede reconstruir un rostro a partir de los datos almacenados. Para más detalles sobre cómo gestionamos su sesión, consulte nuestra <Link to="/app/cookies" className="text-brand-primary underline font-bold">Política de Cookies</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">3. Acceso Restringido</h2>
            <p className="font-medium text-brand-gray text-justify">
              Solo el personal administrativo autorizado de la ESPOCH tiene acceso a la gestión de usuarios. Los docentes únicamente pueden visualizar los reportes de asistencia generados por el sistema, sin tener acceso directo a la información biométrica del estudiante.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">4. Ciclo de Vida del Dato</h2>
            <p className="font-medium text-brand-gray text-justify">
              Su información biométrica permanecerá activa mientras mantenga su estatus de estudiante o docente en la institución. En caso de retiro o graduación, los datos pueden ser eliminados permanentemente a solicitud del interesado o tras el periodo de retención académica estipulado.
            </p>
          </section>

          <div className="pt-8 border-t border-brand-border flex justify-center">
            <button onClick={() => navigate(-1)} className="btn btn-dark !px-10">REGRESAR AL PANEL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
