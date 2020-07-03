import BaseCommand from './BaseCommand';
export default class PacketBuilder {
    _command: number[];
    packet: number[];
    constructor();
    set command(command: BaseCommand);
    finalize(): number[];
    checksum(data: number[]): number;
}
