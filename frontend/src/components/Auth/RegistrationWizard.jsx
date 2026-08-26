import { useState } from "react";

import OTPVerification from "./OTPVerification";
import RegistrationForm from "./RegistrationForm";
import CreatePin from "./CreatePin";
import MusicalProfile from "./MusicalProfile";

function RegistrationWizard() {

    const [step, setStep] = useState(1);

    const [registrationData, setRegistrationData] = useState({

        mobile: "",

        otp: "",

        fullName: "",

        dob: "",

        gender: "",

        pin: "",

        languages: [],

        singerType: "",

        skillLevel: "",

        genres: []

    });

    const nextStep = () => {

        setStep((prev) => prev + 1);

    };

    const previousStep = () => {

        setStep((prev) => prev - 1);

    };

    const updateData = (newData) => {

        setRegistrationData({

            ...registrationData,

            ...newData

        });

    };

    switch (step) {

        case 1:

            return (

                <OTPVerification

                    data={registrationData}

                    updateData={updateData}

                    nextStep={nextStep}

                />

            );

        case 2:

            return (

                <RegistrationForm

                    data={registrationData}

                    updateData={updateData}

                    nextStep={nextStep}

                    previousStep={previousStep}

                />

            );

        case 3:

            return (

                <CreatePin

                    data={registrationData}

                    updateData={updateData}

                    nextStep={nextStep}

                    previousStep={previousStep}

                />

            );

        case 4:

            return (

                <MusicalProfile

                    data={registrationData}

                    updateData={updateData}

                    previousStep={previousStep}

                />

            );

        default:

            return null;

    }

}

export default RegistrationWizard;