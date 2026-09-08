import {
    FaPhoneAlt,
    FaWhatsapp,
    FaInstagram,
    FaEnvelope
} from "react-icons/fa";

import Navbar from "../common/Navbar/Navbar";

import manikPhoto from "../assets/team/manik.jpg";
import geethaPhoto from "../assets/team/geetha.jpeg";
import ramyaPhoto from "../assets/team/ramya.jpg";
import advaithPhoto from "../assets/team/advaith.jpeg";
import vigneshPhoto from "../assets/team/vignesh.jpeg";
import anandPhoto from "../assets/team/anand.jpeg";
import selvaPhoto from "../assets/team/selva.jpg";

import "./Contact.css";

const CORE_MEMBERS = [
    { name: "Manik", photo: manikPhoto },
    { name: "Geetha", photo: geethaPhoto },
    { name: "Ramya", photo: ramyaPhoto },
    { name: "Advaith", photo: advaithPhoto },
    { name: "Vignesh", photo: vigneshPhoto },
    { name: "Anand", photo: anandPhoto },
    { name: "Selva", photo: selvaPhoto }
];

const getInitials = name =>
    name
        .split(" ")
        .map(part => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

const CONTACT_CHANNELS = [
    {
        icon: <FaPhoneAlt />,
        label: "Call Us",
        value: "+91 98417 96046",
        href: "tel:+919841796046"
    },
    {
        icon: <FaWhatsapp />,
        label: "WhatsApp",
        value: "+91 88078 07498",
        href: "https://wa.me/918807807498"
    },
    {
        icon: <FaInstagram />,
        label: "Instagram",
        value: "@officialbeatsinfinity",
        href: "https://instagram.com/officialbeatsinfinity"
    },
    {
        icon: <FaEnvelope />,
        label: "Email Us",
        value: "beatsinfinity23@gmail.com",
        href: "mailto:beatsinfinity23@gmail.com"
    }
];

function Contact() {

    return (
        <div className="contact-page">
            <Navbar />

            <div className="contact-page-inner">

                <div className="contact-page-header">
                    <span className="contact-page-eyebrow">BEATS ∞ INFINITY</span>
                    <h1>Contact Us</h1>
                    <p>We'd love to hear from you - reach out anytime.</p>
                </div>

                <section className="core-members-section">
                    <h2>Meet the Core Members</h2>

                    <div className="core-members-row">
                        {CORE_MEMBERS.map(member => (
                            <div className="core-member-card" key={member.name}>
                                <div className="core-member-avatar">
                                    {member.photo ? (
                                        <img src={member.photo} alt={member.name} />
                                    ) : (
                                        <span>{getInitials(member.name)}</span>
                                    )}
                                </div>
                                <div className="core-member-name">{member.name}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="contact-channels-section">
                    <h2>Get In Touch</h2>

                    <div className="contact-channels-grid">
                        {CONTACT_CHANNELS.map(channel => (
                            <a
                                href={channel.href}
                                target={channel.href.startsWith("http") ? "_blank" : undefined}
                                rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
                                className="contact-channel-card"
                                key={channel.label}
                            >
                                <div className="contact-channel-icon">
                                    {channel.icon}
                                </div>
                                <div>
                                    <div className="contact-channel-label">{channel.label}</div>
                                    <div className="contact-channel-value">{channel.value}</div>
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );

}

export default Contact;
