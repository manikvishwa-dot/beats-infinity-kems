import { useEffect, useState } from "react";

import { getMyPairing } from "../../../services/pairingService";

import "./PairingStatus.css";

function PairingStatus({ singerId }) {

    const [pairing, setPairing] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        let cancelled = false;

        const load = async () => {

            if (!singerId) {

                setLoading(false);
                return;

            }

            try {

                const result = await getMyPairing(singerId);

                if (!cancelled) {

                    setPairing(result.pairing || null);

                }

            }
            catch (error) {

                console.error(
                    "Unable to load pairing status:",
                    error
                );

            }
            finally {

                if (!cancelled) {

                    setLoading(false);

                }

            }

        };

        load();

        return () => {

            cancelled = true;

        };

    }, [singerId]);

    if (loading || !pairing) {

        return null;

    }

    return (

        <section className="pairing-status-card">

            <div className="pairing-status-icon">
                🎉
            </div>

            <div>
                <h3>Pairing Available</h3>

                <p>
                    You have been paired with{" "}
                    <strong>{pairing.partner_name}</strong>{" "}
                    for <strong>{pairing.song_title}</strong>.
                </p>
            </div>

        </section>

    );

}

export default PairingStatus;
