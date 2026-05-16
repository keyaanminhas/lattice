import React, { useState, useEffect } from "react";
import { Zap, BrainCircuit, Users, ShieldCheck, Check, Sparkles } from "lucide-react";

export default function AIPricingSection() {
  const [calculating, setCalculating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState(5);

  const plan = {
    name: "AI Enterprise Model",
    desc: "Dynamic pricing optimized by our neural engine based on your team size and computing needs.",
    basePrice: 32,
    features: [
      "Custom embedding generation",
      "Real-time ecosystem analytics",
      "Automated startup-mentor matching",
      "Predictive outcome simulation",
      "Priority API access",
      "Unlimited team collaboration",
    ],
  };

  const features = [
    {
      name: "Adaptive Compute",
      desc: "Our AI scales server resources dynamically to match your usage spikes instantly without downtime.",
      icon: <Zap className="w-6 h-6" />,
    },
    {
      name: "Neural Matching",
      desc: "Advanced embedding models cluster and match startups with the perfect programmes and mentors.",
      icon: <BrainCircuit className="w-6 h-6" />,
    },
    {
      name: "Team Collaboration",
      desc: "Built for teams. Add as many reviewers, directors, and admins as your ecosystem requires.",
      icon: <Users className="w-6 h-6" />,
    },
    {
      name: "Governed Security",
      desc: "Enterprise-grade isolation for your proprietary AI models and ecosystem data.",
      icon: <ShieldCheck className="w-6 h-6" />,
    },
  ];

  // AI Calculation simulation
  useEffect(() => {
    setCalculating(true);
    const timer = setTimeout(() => setCalculating(false), 800);
    return () => clearTimeout(timer);
  }, [selectedUsers]);

  const calculatedPrice = plan.basePrice + (selectedUsers * 12);

  return (
    <section className="relative py-14 w-full flex p-2 justify-center bg-purple-950/5 overflow-hidden">
      <div className="absolute top-0 z-[0] h-screen w-full bg-[radial-gradient(ellipse_20%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]"></div>

      <div className="relative z-10 max-w-screen-xl mx-auto text-gray-600 md:px-8">
        <div className="relative max-w-xl space-y-3 px-4 md:px-0">
          <h3 className="text-purple-700 font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> AI Optimized Pricing
          </h3>
          <p className="mt-2 text-4xl font-normal tracking-tighter sm:text-5xl text-gray-900">
            Intelligent pricing that adapts to{" "}
            <br className="hidden sm:inline lg:hidden" />
            your ecosystem.
          </p>
          <div className="max-w-xl">
            <p className="text-gray-600">
              Select your expected user base. Our AI model automatically calculates the optimal compute resources and pricing for your specific needs.
            </p>
          </div>
        </div>
        <div className="mt-16 justify-between gap-8 md:flex">
          <ul className="flex-1 max-w-md space-y-10 px-4 md:px-0">
            {features.map((item, idx) => (
              <li key={idx} className="flex gap-x-3">
                <div className="flex-none w-12 h-12 rounded-full bg-purple-100/60 text-purple-700 flex items-center justify-center border border-purple-200">
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-lg text-gray-900 font-medium tracking-tight">
                    {item.name}
                  </h4>
                  <p className="text-gray-600 mt-2 md:text-sm">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          
          <div className="flex-1 flex flex-col border-y mt-6 md:max-w-xl md:rounded-2xl md:border md:border-gray-200 md:shadow-xl md:mt-0 bg-white">
            <div className="p-4 py-8 border-b md:p-8 bg-gray-50/50 rounded-t-2xl">
              <div className="mb-8">
                <label className="text-sm font-semibold text-gray-700 flex justify-between mb-3">
                  <span>Ecosystem Size (Users)</span>
                  <span className="text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{selectedUsers} Active Users</span>
                </label>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={selectedUsers} 
                  onChange={(e) => setSelectedUsers(parseInt(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              <div className="justify-between flex items-start">
                <div className="max-w-xs">
                  <span className="text-2xl text-gray-900 font-semibold tracking-tighter sm:text-3xl flex items-center gap-2">
                    {plan.name}
                  </span>
                  <p className="mt-3 text-sm text-gray-500">{plan.desc}</p>
                </div>
                <div className="flex-none text-gray-900 text-3xl font-semibold sm:text-4xl text-right">
                  {calculating ? (
                    <span className="animate-pulse text-purple-400">...</span>
                  ) : (
                    <span>${calculatedPrice}</span>
                  )}
                  <div className="text-sm text-gray-500 font-normal mt-1">/month</div>
                </div>
              </div>
              <button className="mt-8 w-full tracking-tighter text-center rounded-xl text-md bg-gradient-to-br from-purple-600 to-indigo-800 px-4 py-3.5 text-lg text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 font-medium">
                Activate AI Instance
              </button>
            </div>
            <ul className="p-6 space-y-4 sm:grid sm:grid-cols-2 md:block md:p-8 lg:grid gap-x-4">
              <div className="pb-2 col-span-2 text-gray-900 font-semibold">
                <p>Included Capabilities</p>
              </div>
              {plan.features.map((featureItem, idx) => (
                <li key={idx} className="flex items-start gap-3 text-gray-600 text-sm">
                  <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  <span>{featureItem}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
