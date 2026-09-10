type CustomerSnapshotSource = {
  name: string;
  phone: string;
  email: string | null;
  cpfCnpj: string | null;
};

type BikeSnapshotSource = {
  brand: string;
  model: string;
  year: number | null;
  type: string | null;
  wheelSize: string | null;
  frameSize: string | null;
  color: string | null;
  serialNumber: string | null;
  notes: string | null;
};

export function createCustomerSnapshot(customer: CustomerSnapshotSource) {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    cpfCnpj: customer.cpfCnpj,
  };
}

export function createBikeSnapshot(bike: BikeSnapshotSource) {
  return {
    brand: bike.brand,
    model: bike.model,
    year: bike.year,
    type: bike.type,
    wheelSize: bike.wheelSize,
    frameSize: bike.frameSize,
    color: bike.color,
    serialNumber: bike.serialNumber,
    notes: bike.notes,
  };
}
