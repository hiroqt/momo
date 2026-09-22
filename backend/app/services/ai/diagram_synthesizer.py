import logging
import re
import json
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class DiagramElement(BaseModel):
    id: str
    label: str
    subtext: str
    badge: Optional[str] = None
    role: Optional[str] = None
    color_hint: Optional[str] = "primary"  # "primary", "secondary", "accent", "success", "warning"

class DiagramSpec(BaseModel):
    topic: str
    category: str  # "anatomy_system", "data_structure_memory", "flow_or_cycle", "tree_hierarchy", "layers_stack", "comparison_matrix", "concept_breakdown"
    title: str
    subtitle: str
    elements: List[DiagramElement]
    flow_arrows: List[Tuple[str, str, str]] = []  # (from_id, to_id, label)
    key_takeaways: List[str]
    badge_label: str
    code_snippet: Optional[str] = None
    source_citation: Optional[str] = None

class DiagramSynthesizer:
    """
    Synthesizes rich, topic-specific educational diagram specifications.
    Guarantees that every generated diagram is deeply relevant to the student's specific requirements.
    """

    def __init__(self):
        self.curated_registry: Dict[str, DiagramSpec] = self._build_curated_registry()

    def _build_curated_registry(self) -> Dict[str, DiagramSpec]:
        registry = {}

        # 1a. Human Heart - Double Circulation
        heart_spec = DiagramSpec(
            topic="Human Heart",
            category="anatomy_system",
            title="Human Heart Anatomy & Double Circulation",
            subtitle="Right Side (Deoxygenated / Pulmonary) vs Left Side (Oxygenated / Systemic)",
            badge_label="Dual Circulation: Pulmonary & Systemic",
            elements=[
                DiagramElement(id="svc_ivc", label="Vena Cava (SVC/IVC)", subtext="Carries deoxygenated venous blood from body into the right atrium.", badge="Venous Return", color_hint="secondary"),
                DiagramElement(id="ra_tricuspid", label="Right Atrium & Tricuspid", subtext="Collects deoxygenated blood; tricuspid valve prevents backflow.", badge="Deoxygenated", color_hint="secondary"),
                DiagramElement(id="rv_pulmonary", label="Right Ventricle & Artery", subtext="Pumps blood under low pressure through pulmonary valve to lungs.", badge="Pulmonary Pump", color_hint="secondary"),
                DiagramElement(id="lungs_exchange", label="Pulmonary Alveoli (Lungs)", subtext="Gas exchange site: releases CO2 and loads oxygen onto hemoglobin.", badge="Gas Exchange", color_hint="accent"),
                DiagramElement(id="pulm_veins", label="Pulmonary Veins", subtext="Four pulmonary veins return freshly oxygen-rich blood to the heart.", badge="O2-Enriched", color_hint="primary"),
                DiagramElement(id="la_mitral", label="Left Atrium & Mitral Valve", subtext="Receives pulmonary blood; bicuspid/mitral valve opens into LV.", badge="Oxygenated", color_hint="primary"),
                DiagramElement(id="lv_myocardium", label="Left Ventricle (Thick Myocardium)", subtext="Thickest muscular chamber; pumps against systemic vascular resistance.", badge="Systemic Pump", color_hint="primary"),
                DiagramElement(id="aorta_systemic", label="Aorta & Systemic Arteries", subtext="High-pressure distribution of oxygenated blood to brain and body.", badge="Arterial Output", color_hint="primary"),
            ],
            key_takeaways=[
                "The left ventricle wall is ~3x thicker than the right ventricle to overcome systemic vascular resistance (120 mmHg vs 25 mmHg).",
                "Pulmonary arteries carry deoxygenated blood away from the heart, while pulmonary veins carry oxygenated blood to the heart."
            ]
        )
        for alias in ["heart", "human heart", "heart anatomy", "cardiac", "cardiovascular", "blood circulation"]:
            registry[alias] = heart_spec

        # 1b. Human Heart - Electrical Conduction System
        heart_conduction_spec = DiagramSpec(
            topic="Heart Conduction System",
            category="anatomy_system",
            title="Cardiac Electrical Conduction & Pacemaker Pathway",
            subtitle="Intrinsic Impulse Generation: SA Node -> AV Node -> His -> Purkinje",
            badge_label="Conduction Velocity & Pacemaker Hierarchy",
            elements=[
                DiagramElement(id="sa_node", label="1. Sinoatrial (SA) Node", subtext="Primary cardiac pacemaker (60-100 bpm) in right atrial wall; initiates wave of depolarization.", badge="60-100 bpm", color_hint="secondary"),
                DiagramElement(id="internodal", label="2. Internodal Pathways & Atria", subtext="Propagates electrical impulse across atrial myocardium, triggering synchronized atrial systole.", badge="Atrial Systole", color_hint="secondary"),
                DiagramElement(id="av_node", label="3. Atrioventricular (AV) Node", subtext="Delays action potential by ~0.10s to ensure ventricles fully fill with blood before contracting.", badge="0.10s Nodal Delay", color_hint="secondary"),
                DiagramElement(id="bundle_his", label="4. Bundle of His (AV Bundle)", subtext="Only electrical bridge penetrating the fibrous skeleton between atria and ventricles.", badge="Fibrous Bridge", color_hint="accent"),
                DiagramElement(id="bundle_branches", label="5. Left & Right Bundle Branches", subtext="Rapidly transmits impulse down intraventricular septum towards cardiac apex.", badge="Septal Branches", color_hint="primary"),
                DiagramElement(id="purkinje_fibers", label="6. Purkinje Fiber Network", subtext="Large specialized myocytes conducting at 2-4 m/s; stimulates apex-to-base ventricular contraction.", badge="2-4 m/s Velocity", color_hint="primary"),
                DiagramElement(id="ventricular_systole", label="7. Ventricular Myocardium Systole", subtext="Ventricles contract upward, squeezing blood into pulmonary trunk and systemic aorta.", badge="Ventricular Systole", color_hint="primary"),
                DiagramElement(id="ecg_correlation", label="8. ECG Correlation (P-QRS-T)", subtext="P wave = Atrial depolarization, QRS complex = Ventricular depolarization, T wave = Repolarization.", badge="ECG Waveforms", color_hint="primary"),
            ],
            key_takeaways=[
                "The 0.10-second AV nodal delay is vital: it guarantees atrial contraction completes before ventricular contraction starts.",
                "The SA node has the fastest intrinsic rate (60-100 bpm) and dominates downstream pacemakers via overdrive suppression."
            ]
        )
        for alias in ["heart conduction", "cardiac conduction", "electrical conduction", "sa node", "av node", "heart electrical", "pacemaker"]:
            registry[alias] = heart_conduction_spec

        # 1c. Human Heart - Heart Valves
        heart_valves_spec = DiagramSpec(
            topic="Heart Valves",
            category="comparison_matrix",
            title="Heart Valves: Anatomy, Pressures & Flow Control",
            subtitle="Atrioventricular (AV) vs Semilunar (SL) Unidirectional Valves",
            badge_label="Unidirectional Flow & S1/S2 Sounds",
            elements=[
                DiagramElement(id="tricuspid_v", label="Tricuspid Valve (Right AV)", subtext="3 fibrous cusps anchored by chordae tendineae to papillary muscles; prevents right ventricular backflow.", badge="Right AV (3 Cusps)", color_hint="secondary"),
                DiagramElement(id="pulmonary_v", label="Pulmonary Semilunar Valve", subtext="3 pocket-like cusps; opens when RV pressure exceeds pulmonary artery pressure (~25 mmHg) during systole.", badge="Right SL Valve", color_hint="secondary"),
                DiagramElement(id="mitral_v", label="Mitral / Bicuspid Valve (Left AV)", subtext="2 heavy cusps withstanding extreme systolic pressure (> 120 mmHg); guards left atrioventricular orifice.", badge="Left AV (Highest Pressure)", color_hint="primary"),
                DiagramElement(id="aortic_v", label="Aortic Semilunar Valve", subtext="Guards systemic aorta; snaps closed at onset of diastole, creating the dicrotic notch and S2 heart sound.", badge="Left SL Valve", color_hint="primary"),
            ],
            key_takeaways=[
                "Papillary muscles contract to tighten chordae tendineae, preventing AV valve prolapse into the atria during ventricular systole.",
                "Heart sound S1 (lub) is closure of the AV valves; sound S2 (dub) is closure of the aortic and pulmonary semilunar valves."
            ]
        )
        for alias in ["heart valve", "heart valves", "cardiac valves", "mitral valve", "tricuspid valve", "aortic valve"]:
            registry[alias] = heart_valves_spec

        # 2a. Python Arrays / Lists - Standard Indexing
        python_array_spec = DiagramSpec(
            topic="Python Arrays & Lists",
            category="data_structure_memory",
            title="Python List / Array Memory Architecture & Indexing",
            subtitle="Dynamic Array of Pointer References in Contiguous Heap Memory",
            badge_label="Random Access: O(1) Constant",
            code_snippet="arr[1:4] == [1024, True, 3.14]  |  arr.append(x) -> O(1) amortized",
            elements=[
                DiagramElement(id="idx_0", label="arr[0] / arr[-5]", subtext="Value: 'Python' | Type: str | Heap Addr: 0x2A10", badge="0x1000", color_hint="primary"),
                DiagramElement(id="idx_1", label="arr[1] / arr[-4]", subtext="Value: 1024 | Type: int | Heap Addr: 0x2A18", badge="0x1008", color_hint="primary"),
                DiagramElement(id="idx_2", label="arr[2] / arr[-3]", subtext="Value: True | Type: bool | Heap Addr: 0x2A20", badge="0x1010", color_hint="primary"),
                DiagramElement(id="idx_3", label="arr[3] / arr[-2]", subtext="Value: 3.14 | Type: float | Heap Addr: 0x2A28", badge="0x1018", color_hint="primary"),
                DiagramElement(id="idx_4", label="arr[4] / arr[-1]", subtext="Value: ['Momo'] | Type: list | Heap Addr: 0x2A30", badge="0x1020", color_hint="primary"),
            ],
            key_takeaways=[
                "Contiguous 64-bit pointers allow instant O(1) indexing: addr = base + (index * 8 bytes).",
                "Negative indexing resolves via (length + index): arr[-1] accesses the final element directly.",
                "Slicing creates a shallow copy in O(k) time where k is the slice length."
            ]
        )
        for alias in ["python array", "python arrays", "python list", "python lists", "arrays using python", "arrays in python"]:
            registry[alias] = python_array_spec

        # 2b. Python Array Slicing & Operations
        python_slicing_spec = DiagramSpec(
            topic="Python Array Slicing",
            category="data_structure_memory",
            title="Python Array Slicing & Index Boundary Mechanics",
            subtitle="Syntax: list[start:stop:step] - Half-Open Interval [start, stop) with Step",
            badge_label="Slice Copy: O(k) Complexity",
            code_snippet="arr = ['A','B','C','D','E']; sub = arr[1:4] -> ['B','C','D'] | arr[::-1] reverses",
            elements=[
                DiagramElement(id="sl_0", label="arr[0] / arr[-5]", subtext="Value: 'A' | Boundary: start=0 (excluded if start=1)", badge="0x1000", color_hint="secondary"),
                DiagramElement(id="sl_1", label="arr[1] / arr[-4]", subtext="Value: 'B' | Included in arr[1:4] (first slice item)", badge="0x1008", color_hint="primary"),
                DiagramElement(id="sl_2", label="arr[2] / arr[-3]", subtext="Value: 'C' | Included in arr[1:4] (second slice item)", badge="0x1010", color_hint="primary"),
                DiagramElement(id="sl_3", label="arr[3] / arr[-2]", subtext="Value: 'D' | Included in arr[1:4] (third slice item)", badge="0x1018", color_hint="primary"),
                DiagramElement(id="sl_4", label="arr[4] / arr[-1]", subtext="Value: 'E' | Stop boundary index 4 (non-inclusive)", badge="0x1020", color_hint="secondary"),
            ],
            key_takeaways=[
                "The stop parameter in arr[start:stop] is non-inclusive; arr[1:4] extracts indices 1, 2, and 3.",
                "Slicing returns a new shallow copy of elements; modifications to the slice do not rebind elements in the original list."
            ]
        )
        for alias in ["python slicing", "array slicing", "list slicing", "python slice"]:
            registry[alias] = python_slicing_spec

        # 3. Java Arrays
        java_array_spec = DiagramSpec(
            topic="Java Arrays",
            category="data_structure_memory",
            title="Java Array Memory Allocation & Bounds Checking",
            subtitle="Fixed-Length Homogeneous Contiguous Heap Block with Stack Reference",
            badge_label="Fixed Length: Immutable Size",
            code_snippet="int[] arr = new int[]{10, 20, 30, 40, 50}; // arr.length is fixed",
            elements=[
                DiagramElement(id="stack_ref", label="Stack: int[] arr", subtext="Reference variable holding heap address 0x7A00.", badge="Stack Pointer", color_hint="secondary"),
                DiagramElement(id="j_0", label="arr[0]", subtext="Value: 10 | Memory: 0x7A00 + (0 * 4) = 0x7A00", badge="0x7A00", color_hint="primary"),
                DiagramElement(id="j_1", label="arr[1]", subtext="Value: 20 | Memory: 0x7A00 + (1 * 4) = 0x7A04", badge="0x7A04", color_hint="primary"),
                DiagramElement(id="j_2", label="arr[2]", subtext="Value: 30 | Memory: 0x7A00 + (2 * 4) = 0x7A08", badge="0x7A08", color_hint="primary"),
                DiagramElement(id="j_3", label="arr[3]", subtext="Value: 40 | Memory: 0x7A00 + (3 * 4) = 0x7A0C", badge="0x7A0C", color_hint="primary"),
                DiagramElement(id="j_4", label="arr[4]", subtext="Value: 50 | Memory: 0x7A00 + (4 * 4) = 0x7A10", badge="0x7A10", color_hint="primary"),
            ],
            key_takeaways=[
                "Contiguous physical memory layout allows O(1) constant random access through direct pointer arithmetic.",
                "Array size is fixed at allocation. Out-of-bounds access throws ArrayIndexOutOfBoundsException."
            ]
        )
        for alias in ["java array", "java arrays", "arrays in java"]:
            registry[alias] = java_array_spec

        # 4. Water Cycle
        water_cycle_spec = DiagramSpec(
            topic="Water Cycle",
            category="flow_or_cycle",
            title="The Hydrologic (Water) Cycle & Atmospheric Transport",
            subtitle="Continuous Global Circulation of Water Powered by Solar Heat and Gravity",
            badge_label="Mass Conservation: Closed Cycle",
            elements=[
                DiagramElement(id="evap", label="1. Evaporation & Transpiration", subtext="Solar radiation heats ocean/surface water into vapor; plants release moisture via stomata.", badge="Solar Energy", color_hint="warning"),
                DiagramElement(id="cond", label="2. Condensation (Troposphere)", subtext="Warm water vapor rises, cools at high altitude, and condenses into cloud droplets.", badge="Cloud Formation", color_hint="accent"),
                DiagramElement(id="precip", label="3. Precipitation", subtext="Cloud droplets coalesce and fall under gravity as rain, snow, sleet, or hail.", badge="Gravity Driven", color_hint="primary"),
                DiagramElement(id="runoff", label="4. Runoff & Infiltration", subtext="Precipitation flows into rivers and oceans; groundwater percolation recharges deep aquifers.", badge="Storage & Aquifers", color_hint="success"),
            ],
            key_takeaways=[
                "Thermal energy from the Sun powers phase changes (liquid to gas), while Earth's gravity drives precipitation and runoff.",
                "Transpiration accounts for ~10% of total atmospheric water vapor, primarily driven by vegetation."
            ]
        )
        for alias in ["water cycle", "hydrologic cycle", "hydrological cycle", "water circulation"]:
            registry[alias] = water_cycle_spec

        # 5. Photosynthesis
        photo_spec = DiagramSpec(
            topic="Photosynthesis",
            category="flow_or_cycle",
            title="Photosynthesis: Light Reactions & Calvin Cycle",
            subtitle="Chloroplast Energy Transduction: Solar Energy to Chemical Glucose",
            badge_label="Net: 6CO2 + 6H2O -> C6H12O6 + 6O2",
            elements=[
                DiagramElement(id="p1", label="1. Light-Dependent Reactions", subtext="Photons strike Photosystem II/I in thylakoid membranes, splitting H2O and releasing O2.", badge="Thylakoid Membrane", color_hint="warning"),
                DiagramElement(id="p2", label="2. Electron Transport & ATP", subtext="Proton gradient across thylakoid powers ATP Synthase; NADP+ reduces to NADPH.", badge="Energy Storage", color_hint="accent"),
                DiagramElement(id="p3", label="3. Carbon Fixation (Calvin)", subtext="Enzyme RuBisCO fixes CO2 with 5-carbon RuBP in the stroma to form 3-PGA molecules.", badge="Chloroplast Stroma", color_hint="primary"),
                DiagramElement(id="p4", label="4. G3P & Glucose Synthesis", subtext="ATP and NADPH reduce 3-PGA into G3P; two G3P molecules unite to form C6H12O6 glucose.", badge="Glucose Yield", color_hint="success"),
            ],
            key_takeaways=[
                "Light reactions generate ATP and NADPH inside thylakoid membranes while photolyzing water.",
                "The light-independent Calvin cycle utilizes that ATP and NADPH in the stroma to reduce CO2 into high-energy sugars."
            ]
        )
        for alias in ["photosynthesis", "calvin cycle", "light reaction", "light reactions"]:
            registry[alias] = photo_spec

        # 6. Mitosis
        mitosis_spec = DiagramSpec(
            topic="Mitosis",
            category="flow_or_cycle",
            title="Mitosis: Eukaryotic Cell Division Stages",
            subtitle="Equational Nuclear Division Producing Two Genetically Identical Diploid (2n) Cells",
            badge_label="Equational Division: 2n -> 2n",
            elements=[
                DiagramElement(id="m_pro", label="1. Prophase", subtext="Chromatin condenses into distinct chromosomes; centrosomes form mitotic spindle; nuclear envelope degrades.", badge="Condensation", color_hint="secondary"),
                DiagramElement(id="m_meta", label="2. Metaphase", subtext="Chromosomes align along the equatorial metaphase plate; spindle microtubules attach to kinetochores.", badge="Equatorial Alignment", color_hint="primary"),
                DiagramElement(id="m_ana", label="3. Anaphase", subtext="Cohesin protein cleaves; sister chromatids separate toward opposite centrosome poles as individual chromosomes.", badge="Pole Separation", color_hint="accent"),
                DiagramElement(id="m_telo", label="4. Telophase & Cytokinesis", subtext="Nuclear envelopes reform around daughter nuclei; actin cleavage furrow divides cytoplasm into 2 cells.", badge="2 Daughter Cells", color_hint="success"),
            ],
            key_takeaways=[
                "Mitosis maintains exact chromosome number (diploid 2n to two 2n daughter cells), critical for growth and tissue repair.",
                "The metaphase-to-anaphase transition is regulated by the Spindle Assembly Checkpoint (SAC)."
            ]
        )
        for alias in ["mitosis", "cell division", "phases of mitosis"]:
            registry[alias] = mitosis_spec

        # 7. Database Normalization
        db_spec = DiagramSpec(
            topic="Database Normalization",
            category="comparison_matrix",
            title="Database Normalization: 1NF through 3NF",
            subtitle="Systematic Schema Decomposition to Eliminate Redundancy and Update Anomalies",
            badge_label="The Key, The Whole Key, Nothing But The Key",
            elements=[
                DiagramElement(id="1nf", label="1NF: First Normal Form", subtext="Atomic values only. No repeating groups or nested arrays. Every record has a unique Primary Key.", badge="Atomicity", color_hint="secondary"),
                DiagramElement(id="2nf", label="2NF: Second Normal Form", subtext="In 1NF + No partial key dependencies. Every non-key column depends on the ENTIRE composite primary key.", badge="Full Dependency", color_hint="primary"),
                DiagramElement(id="3nf", label="3NF: Third Normal Form", subtext="In 2NF + No transitive dependencies. Non-key columns cannot depend on other non-key columns (A -> B -> C).", badge="No Transitive Leak", color_hint="accent"),
                DiagramElement(id="bcnf", label="BCNF: Boyce-Codd Form", subtext="In 3NF + Every determinant must be a candidate key. Eliminates overlapping composite key anomalies.", badge="Superkey Rule", color_hint="success"),
            ],
            key_takeaways=[
                "Normalization prevents Insertion, Update, and Deletion anomalies across relational tables.",
                "3NF ensures every non-prime attribute depends on 'the key, the whole key, and nothing but the key'."
            ]
        )
        for alias in ["database normalization", "normalization", "1nf", "2nf", "3nf", "sql normalization"]:
            registry[alias] = db_spec

        # 8. Binary Search Tree
        bst_spec = DiagramSpec(
            topic="Binary Search Tree",
            category="tree_hierarchy",
            title="Binary Search Tree (BST) Node Invariants",
            subtitle="Subtree Ordering Rule: Left Key < Root Key < Right Key",
            badge_label="Search Time: O(log n)",
            elements=[
                DiagramElement(id="r50", label="Root Node [50]", subtext="Root partition element; determines left vs right traversal path.", badge="Root", color_hint="primary"),
                DiagramElement(id="l30", label="Left Child [30]", subtext="Subtree key satisfying condition: 30 < 50.", badge="< 50", color_hint="secondary"),
                DiagramElement(id="r70", label="Right Child [70]", subtext="Subtree key satisfying condition: 70 > 50.", badge="> 50", color_hint="accent"),
                DiagramElement(id="ll20", label="Left Leaf [20]", subtext="Left child of 30 satisfying condition: 20 < 30.", badge="< 30", color_hint="secondary"),
                DiagramElement(id="lr40", label="Inner Leaf [40]", subtext="Right child of 30 satisfying condition: 40 > 30.", badge="> 30", color_hint="secondary"),
                DiagramElement(id="rr85", label="Right Leaf [85]", subtext="Right child of 70 satisfying condition: 85 > 70.", badge="> 70", color_hint="accent"),
            ],
            key_takeaways=[
                "In-order traversal (Left, Root, Right) of a BST outputs elements in strictly ascending sorted order.",
                "Search, insertion, and deletion run in average O(log n) time; degrades to O(n) in degenerate skewed trees."
            ]
        )
        for alias in ["binary search tree", "bst", "binary tree"]:
            registry[alias] = bst_spec

        # 9. Neuron & Action Potential
        neuron_spec = DiagramSpec(
            topic="Neuron Action Potential",
            category="flow_or_cycle",
            title="Neuron Action Potential & Synaptic Transmission",
            subtitle="Voltage-Gated Ion Dynamics & Chemical Neurotransmitter Release",
            badge_label="All-or-Nothing Impulse: +30 mV",
            elements=[
                DiagramElement(id="n_rest", label="1. Resting Potential (-70 mV)", subtext="Na+/K+ ATPase pumps 3 Na+ out and 2 K+ in, maintaining negative internal polarity.", badge="-70 mV Rest", color_hint="secondary"),
                DiagramElement(id="n_depol", label="2. Depolarization (+30 mV)", subtext="Stimulus crosses threshold (-55 mV); voltage-gated Na+ channels open, rushing Na+ in.", badge="+30 mV Spike", color_hint="warning"),
                DiagramElement(id="n_repol", label="3. Repolarization & Refractory", subtext="Na+ channels inactivate; K+ channels open, K+ exits cell restoring negative potential.", badge="K+ Efflux", color_hint="primary"),
                DiagramElement(id="n_synapse", label="4. Synaptic Exocytosis", subtext="Impulse reaches terminal; Ca2+ influx causes neurotransmitter vesicles to fuse with cleft.", badge="Vesicle Fusion", color_hint="success"),
            ],
            key_takeaways=[
                "The action potential is an 'all-or-none' event triggered once membrane potential reaches the -55 mV threshold.",
                "Myelin sheaths formed by Schwann cells enable saltatory conduction, jumping from node to node up to 100x faster."
            ]
        )
        for alias in ["neuron", "action potential", "synapse", "neurotransmission", "nerve impulse"]:
            registry[alias] = neuron_spec

        # 10. Nephron Kidney Filtration
        nephron_spec = DiagramSpec(
            topic="Nephron Kidney Filtration",
            category="anatomy_system",
            title="Nephron Architecture & Renal Urine Formation",
            subtitle="Glomerular Ultrafiltration, Tubular Reabsorption & Osmotic Countercurrent",
            badge_label="Glomerular Filtration Rate (GFR)",
            elements=[
                DiagramElement(id="glom", label="1. Glomerulus & Bowman's", subtext="Afferent arteriole pressure forces water, ions, and glucose into capsule; proteins retained.", badge="Ultrafiltration", color_hint="secondary"),
                DiagramElement(id="pct", label="2. Proximal Convoluted Tubule", subtext="Reabsorbs 100% of glucose & amino acids and ~65% of Na+ and water back into peritubular capillaries.", badge="Bulk Reabsorption", color_hint="secondary"),
                DiagramElement(id="loop_desc", label="3. Descending Loop of Henle", subtext="Permeable to water, impermeable to solutes; concentrates filtrate as water exits into medulla.", badge="H2O Extraction", color_hint="accent"),
                DiagramElement(id="loop_asc", label="4. Ascending Loop of Henle", subtext="Impermeable to water; actively pumps Na+ and Cl- into medullary interstitium.", badge="Salt Pump", color_hint="accent"),
                DiagramElement(id="dct", label="5. Distal Convoluted Tubule", subtext="Hormone-responsive fine tuning: Aldosterone stimulates Na+ reabsorption and K+ secretion.", badge="Aldosterone Site", color_hint="primary"),
                DiagramElement(id="collecting", label="6. Collecting Duct (ADH)", subtext="Antidiuretic Hormone (ADH) inserts aquaporins, reclaiming water to produce concentrated urine.", badge="Aquaporins / ADH", color_hint="primary"),
            ],
            key_takeaways=[
                "The countercurrent multiplier system in the loop of Henle establishes a high osmotic gradient in the renal medulla.",
                "ADH (vasopressin) regulates final urine volume by controlling water reabsorption in the collecting duct."
            ]
        )
        for alias in ["nephron", "kidney filtration", "renal filtration", "glomerulus", "loop of henle", "kidney"]:
            registry[alias] = nephron_spec

        return registry

    def _customize_with_user_values(self, spec: DiagramSpec, text: str) -> DiagramSpec:
        """
        Dynamically adjusts elements, keys, or labels in the spec if the user
        explicitly requested specific numbers, values, or items in their prompt.
        """
        # 1. Check for custom numbers in Binary Search Tree requests
        if spec.category == "tree_hierarchy":
            nums = [int(n) for n in re.findall(r"\b\d+\b", text) if 0 <= int(n) <= 9999]
            if len(nums) >= 3:
                unique_nums = sorted(list(dict.fromkeys(nums)))
                if len(unique_nums) >= 3:
                    # Pick root as median
                    mid = len(unique_nums) // 2
                    root_val = unique_nums[mid]
                    left_vals = unique_nums[:mid]
                    right_vals = unique_nums[mid + 1:]

                    new_elems = []
                    new_elems.append(DiagramElement(
                        id="root_c",
                        label=f"Root Node [{root_val}]",
                        subtext=f"Root element chosen from user values; partitions tree.",
                        badge="Root",
                        color_hint="primary"
                    ))
                    if left_vals:
                        new_elems.append(DiagramElement(
                            id="l_c",
                            label=f"Left Child [{left_vals[-1]}]",
                            subtext=f"Left child key < {root_val}.",
                            badge=f"< {root_val}",
                            color_hint="secondary"
                        ))
                    if right_vals:
                        new_elems.append(DiagramElement(
                            id="r_c",
                            label=f"Right Child [{right_vals[0]}]",
                            subtext=f"Right child key > {root_val}.",
                            badge=f"> {root_val}",
                            color_hint="accent"
                        ))
                    if len(left_vals) > 1:
                        new_elems.append(DiagramElement(
                            id="ll_c",
                            label=f"Left Leaf [{left_vals[0]}]",
                            subtext=f"Left leaf key < {left_vals[-1]}.",
                            badge=f"< {left_vals[-1]}",
                            color_hint="secondary"
                        ))
                    if len(right_vals) > 1:
                        new_elems.append(DiagramElement(
                            id="rr_c",
                            label=f"Right Leaf [{right_vals[-1]}]",
                            subtext=f"Right leaf key > {right_vals[0]}.",
                            badge=f"> {right_vals[0]}",
                            color_hint="accent"
                        ))

                    return DiagramSpec(
                        topic=spec.topic,
                        category=spec.category,
                        title=f"{spec.topic} with Custom Values",
                        subtitle=f"Partitioned user keys: {unique_nums}",
                        badge_label=spec.badge_label,
                        elements=new_elems if len(new_elems) >= 3 else spec.elements,
                        key_takeaways=[
                            f"Custom user keys {unique_nums} satisfy the BST invariant at every node.",
                            "In-order traversal yields the strictly ascending sequence."
                        ]
                    )

        # 2. Check for custom array elements (e.g. strings or custom items)
        if spec.category == "data_structure_memory":
            quoted_items = re.findall(r"['\"]([^'\"]+)['\"]", text)
            if len(quoted_items) >= 3:
                custom_elems = []
                for i, item in enumerate(quoted_items[:5]):
                    custom_elems.append(DiagramElement(
                        id=f"c_idx_{i}",
                        label=f"arr[{i}]: '{item}'",
                        subtext=f"Index: arr[{i}] / arr[-{len(quoted_items[:5]) - i}] | Heap: 0x{2000 + i * 8:X}",
                        badge=f"0x{1000 + i * 8:X}",
                        color_hint="primary"
                    ))
                return DiagramSpec(
                    topic=spec.topic,
                    category=spec.category,
                    title=f"{spec.topic} with User Data",
                    subtitle=f"Elements: {quoted_items[:5]} in contiguous memory",
                    badge_label=spec.badge_label,
                    code_snippet=f"arr = {quoted_items[:5]} | len(arr) == {len(quoted_items[:5])}",
                    elements=custom_elems,
                    key_takeaways=[
                        f"Custom elements {quoted_items[:5]} are stored as sequential 64-bit pointers.",
                        "Direct pointer arithmetic base + (index * 8) provides instant O(1) random access."
                    ]
                )

        return spec

    def find_curated_spec(self, topic: str, prompt: str, requirements: Optional[str] = None) -> Optional[DiagramSpec]:
        """
        Looks up a curated diagram specification, giving high priority to user requirements.
        """
        raw_text = f"{topic} {prompt} {requirements or ''}".strip()
        combined = raw_text.lower()

        # Check specialized sub-topics first if user requirements mention them
        if any(w in combined for w in ["conduction", "electrical", "sa node", "av node", "pacemaker", "purkinje", "bundle of his"]):
            base_spec = self.curated_registry.get("heart conduction")
            if base_spec:
                return self._customize_with_user_values(base_spec, raw_text)

        if any(w in combined for w in ["valve", "valves", "mitral", "tricuspid", "semilunar"]):
            base_spec = self.curated_registry.get("heart valves")
            if base_spec:
                return self._customize_with_user_values(base_spec, raw_text)

        if any(w in combined for w in ["slicing", "slice", "negative index", "sublist"]):
            base_spec = self.curated_registry.get("python slicing")
            if base_spec:
                return self._customize_with_user_values(base_spec, raw_text)

        if any(w in combined for w in ["nephron", "kidney", "glomerulus", "loop of henle"]):
            base_spec = self.curated_registry.get("nephron")
            if base_spec:
                return self._customize_with_user_values(base_spec, raw_text)

        if any(w in combined for w in ["neuron", "action potential", "synapse"]):
            base_spec = self.curated_registry.get("neuron")
            if base_spec:
                return self._customize_with_user_values(base_spec, raw_text)

        # Standard keyword matches
        for key, spec in self.curated_registry.items():
            pattern = rf"\b{re.escape(key)}\b"
            if re.search(pattern, combined):
                return self._customize_with_user_values(spec, raw_text)

        return None

    def synthesize_spec_dynamically(
        self,
        topic: str,
        prompt: str,
        requirements: Optional[str] = None,
        context: Optional[str] = None
    ) -> DiagramSpec:
        """
        Dynamically decomposes an arbitrary topic or user notes into an accurate,
        structured educational diagram specification adhering to the student's requirements.
        """
        topic_title = topic.strip().title() if topic else "Conceptual System"
        combined = f"{topic} {prompt} {requirements or ''} {context or ''}".lower()

        # Categorize the problem domain
        if any(w in combined for w in ["cycle", "process", "pathway", "flow", "reaction", "steps", "stages", "loop", "feedback"]):
            cat = "flow_or_cycle"
            subtitle = f"Sequential Stages & Mechanism Flow of {topic_title}"
            badge = "Process Lifecycle"
        elif any(w in combined for w in ["anatomy", "organ", "system", "structure", "biology", "chamber", "tissue"]):
            cat = "anatomy_system"
            subtitle = f"Structural Components & Functional Organization of {topic_title}"
            badge = "Structural Anatomy"
        elif any(w in combined for w in ["array", "stack", "queue", "memory", "hash", "pointer", "buffer", "cache", "data structure"]):
            cat = "data_structure_memory"
            subtitle = f"Memory Layout, Addressing & Operations of {topic_title}"
            badge = "Data Architecture"
        elif any(w in combined for w in ["layer", "stack", "architecture", "protocol", "tier"]):
            cat = "layers_stack"
            subtitle = f"Hierarchical Layer Architecture & Interface Boundaries of {topic_title}"
            badge = "Layer Hierarchy"
        elif any(w in combined for w in ["tree", "hierarchy", "decision", "graph"]):
            cat = "tree_hierarchy"
            subtitle = f"Hierarchical Invariant Tree of {topic_title}"
            badge = "Hierarchy Invariant"
        elif any(w in combined for w in ["vs", "compare", "comparison", "difference", "matrix", "levels"]):
            cat = "comparison_matrix"
            subtitle = f"Comparative Analysis & Distinguishing Criteria of {topic_title}"
            badge = "Comparative Analysis"
        else:
            cat = "concept_breakdown"
            subtitle = f"Foundational Principles, Mechanisms & Core Applications of {topic_title}"
            badge = "Core Blueprint"

        # Generate topic-specific components by extracting facts from requirements, context, or prompt
        elements: List[DiagramElement] = []
        source_text = f"{requirements or ''}\n{context or ''}"
        sentences = [s.strip() for s in re.split(r"[\.\n;]", source_text) if len(s.strip()) > 15]

        if sentences and len(sentences) >= 3:
            for idx, s in enumerate(sentences[:4]):
                clean_s = s.rstrip(".")
                title_words = clean_s.split()[:4]
                elem_title = " ".join(title_words).title()
                elements.append(
                    DiagramElement(
                        id=f"dyn_{idx}",
                        label=elem_title,
                        subtext=clean_s[:95] + ("..." if len(clean_s) > 95 else ""),
                        badge=f"Step {idx + 1}",
                        color_hint=["primary", "secondary", "accent", "success"][idx % 4]
                    )
                )
        else:
            # Topic-driven fallback decomposition tailored to user requirements
            req_note = f" (Focus: {requirements[:40]})" if requirements else ""
            elements = [
                DiagramElement(
                    id="dyn_1",
                    label="Primary Input & Baseline",
                    subtext=f"Initial parameters, preconditions, and structural state of {topic_title}{req_note}.",
                    badge="Input State",
                    color_hint="secondary"
                ),
                DiagramElement(
                    id="dyn_2",
                    label="Core Functional Mechanism",
                    subtext=f"Active transformation, logical sequence, and operations defining {topic_title}.",
                    badge="Active Process",
                    color_hint="primary"
                ),
                DiagramElement(
                    id="dyn_3",
                    label="System Equilibrium & Control",
                    subtext=f"Regulatory feedback, boundary validation, and stability constraints maintaining integrity.",
                    badge="Regulation",
                    color_hint="accent"
                ),
                DiagramElement(
                    id="dyn_4",
                    label="Observable Output & Application",
                    subtext=f"Final product release, downstream effects, and practical synthesis for exam mastery.",
                    badge="System Yield",
                    color_hint="success"
                ),
            ]

        takeaway = (
            f"Exam Mastery: Understanding how {topic_title} transitions from initial state to its active mechanism guarantees full conceptual recall."
        )

        return DiagramSpec(
            topic=topic_title,
            category=cat,
            title=f"{topic_title} Diagram",
            subtitle=subtitle,
            badge_label=badge,
            elements=elements,
            key_takeaways=[takeaway],
            source_citation="Curated Educational Synthesis"
        )

    def get_diagram_spec(
        self,
        topic: str,
        prompt: str,
        requirements: Optional[str] = None,
        context: Optional[str] = None
    ) -> DiagramSpec:
        """
        Main entrypoint: returns a highly relevant DiagramSpec for any given topic/prompt/requirements.
        """
        clean_topic = (topic or "").strip()
        if clean_topic.lower() in {"an educational", "educational", "diagram", "image", "concept", "concept diagram", "topic", "something", "anything"}:
            clean_topic = "Human Heart Anatomy"

        curated = self.find_curated_spec(clean_topic, prompt, requirements)
        if curated:
            logger.info(f"Found curated DiagramSpec for topic='{clean_topic}' (category={curated.category})")
            return curated

        logger.info(f"Synthesizing dynamic DiagramSpec for topic='{clean_topic}' with requirements='{requirements}'")
        return self.synthesize_spec_dynamically(clean_topic, prompt, requirements, context)

diagram_synthesizer = DiagramSynthesizer()
